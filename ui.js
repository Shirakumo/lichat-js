class LichatUI{
    constructor(el){
        let lichat = this;
        this.commands = {};
        this.clients = [];
        this.currentChannel = null;
        this.search = null;
        this.showEmotePicker = false;
        this.showChannelMenu = false;
        this.showClientMenu = false;
        this.showSelfMenu = false;
        this.showSettings = false;
        this.errorMessage = null;
        this.db = null;
        this.defaultClient = {
            name: "TyNET",
            hostname: "chat.tymoon.eu",
            ssl: true,
            port: LichatDefaultSSLPort
        };

        this.options = {
            transmitTyping: true,
            showNotifications: true,
            playSound: false,
            notificationLevel: 'mention',
            font: 'sans-serif',
            fontSize: '14pt',
            sidebarWidth: '15em',
        };

        let DBOpenRequest = window.indexedDB.open("lichatjs", 4);
        DBOpenRequest.onerror = e=>{
            console.log(e);
            this.initialSetup();
        };
        DBOpenRequest.onsuccess = e=>{
            this.db = e.target.result;
            // FIXME: this does not work as expected.
            //document.addEventListener('beforeunload', this.saveSetup());
            this.loadSetup();
        };
        DBOpenRequest.onupgradeneeded = e=>{
            this.db = e.target.result;
            this.setupDatabase();
        };

        let supersede = (object, field, newfun)=>{
            let original = object.prototype[field];
            object.prototype[field] = function(...args){
                let self = this;
                args.unshift((...args)=>original.apply(self, args));
                newfun.apply(this, args);
            };
        };

        supersede(LichatChannel, 'record', function(nextMethod, update){
            const [message, inserted] = nextMethod(update);
            let notify = inserted && !this.isPrimary;
            if(lichat.currentChannel == message.channel){
                let output = lichat.app.$refs.output;
                if(!output)
                    notify = false;
                else if(output.scrollTop === (output.scrollHeight - output.offsetHeight)){
                    if(!document.hidden) notify = false;
                    Vue.nextTick(() => {
                        document.getElementById(message.gid).scrollIntoView();
                    });
                }
            }
            if(notify) this.notify(message);
        });

        LichatChannel.prototype.notify = function(message){
            this.unread++;
            let notify = false;
            let level = this.notificationLevel;
            if(level == 'inherit')
                level = this.client.options.notificationLevel;
            if(level == 'all')
                notify = true;
            if(message.html.includes("<mark>")){
                if(!this.alerted) this.alerted = true;
                if(level == 'mentions')
                    notify = true;
            }
            if(notify && lichat.options.showNotifications && Notification.permission === "granted"){
                let notification = new Notification(message.from+" in "+this.name, {
                    body: (message.isImage)? undefined: message.text,
                    image: (message.isImage)? message.text: undefined,
                    tag: this.name,
                    actions: [{
                        action: "close",
                        title: "Dismiss"
                    }]
                });
                notification.addEventListener('notificationclick', (ev)=>{
                    event.notification.close();
                    if(event.action != 'close'){
                        message.highlight();
                    }
                });
            }
            if(notify && lichat.options.playSound){
                LichatUI.sound.play();
            }
            lichat.updateTitle();
        };

        document.addEventListener("visibilitychange", ()=>{
            if(!document.hidden){
                this.currentChannel.unread = 0;
                this.currentChannel.alerted = false;
                this.updateTitle();
            }
        });

        LichatMessage.prototype.markupText = function(text){
            return LichatUI.formatUserText(text, this.channel);
        };

        LichatMessage.prototype.highlight = function(){
            lichat.currentChannel = this.channel;
            Vue.nextTick(() => {
                let element = document.getElementById(this.gid);
                element.classList.add('highlight');
                element.scrollIntoView();
            });
        };

        LichatClient.prototype.addToChannelList = function(channel){
            if(this.channelList.length == 0){
                this.channelList.push(channel);
            }else if(!this.channelList.find(element => element === channel)){
                let i=1;
                for(; i<this.channelList.length; ++i){
                    if(0 < this.channelList[i].name.localeCompare(channel.name))
                        break;
                }
                this.channelList.splice(i, 0, channel);
            }
        };

        Vue.component("divider", {
            template: "<div class='divider'></div>",
            data: ()=>{return {
                target: null
            };},
            methods: {
                drag: function(ev){
                    ev.preventDefault();
                    let x = ev.clientX - this.$el.getBoundingClientRect().width;
                    lichat.options.sidebarWidth = x+"px";
                },
                stopDragging: function(ev){
                    ev.preventDefault();
                    document.removeEventListener('mousemove', this.drag);
                    document.removeEventListener('mouseup', this.stopDragging);
                }
            },
            mounted: function(){
                this.target = this.$el.previousElementSibling;
                this.$el.addEventListener('mousedown', (ev)=>{
                    document.addEventListener('mousemove', this.drag);
                    document.addEventListener('mouseup', this.stopDragging);
                });
            }
        });

        Vue.component("self-menu", {
            template: "#self-menu",
            props: {client: LichatClient},
            data: ()=>{
                return {
                    showInfo: false,
                    showIdentitySwitcher: false,
                    showStatus: false
                };
            },
            mounted: function(){
                document.addEventListener('click', (ev)=>{
                    this.$emit('close');
                });
            }
        });

        Vue.component("user-menu", {
            template: "#user-menu",
            props: {user: LichatUser},
            data: ()=>{
                return {
                    showInvite: false,
                    showInfo: false
                };
            },
            mounted: function(){
                document.addEventListener('click', (ev)=>{
                    this.$emit('close');
                });
            },
            methods: {
                whisper: function(){
                    this.user.client.s("CREATE", {})
                        .then((e)=>this.user.client.s("PULL", {
                            target: this.user.name,
                            channel: e.channel
                        })).catch((e)=>this.user.client.showStatus("Error: "+e.text));
                    this.$emit('close');
                },
                block: function(){
                    this.user.client.s("BLOCK", {target: this.message.from})
                        .then((e)=>this.user.client.showStatus(this.user.name+" has been blocked."))
                        .catch((e)=>this.user.client.showStatus("Error: "+e.text));
                    this.$emit('close');
                },
                unblock: function(){
                    this.user.client.s("UNBLOCK", {target: this.user.name})
                        .then((e)=>this.user.client.showStatus(this.user.name+" has been unblocked."))
                        .catch((e)=>this.user.client.showStatus("Error: "+e.text));
                    this.$emit('close');
                },
                ban: function(){
                    this.user.client.s("BAN", {target: this.user.name})
                        .then((e)=>this.user.client.showStatus(this.user.name+" has been banned."))
                        .catch((e)=>this.user.client.showStatus("Error: "+e.text));
                    this.$emit('close');
                },
                unban: function(){
                    this.user.client.s("UNBAN", {target: this.user.name})
                        .then((e)=>this.user.client.showStatus(this.user.name+" has been unbanned."))
                        .catch((e)=>this.user.client.showStatus("Error: "+e.text));
                    this.$emit('close');
                }
            }
        });

        Vue.component("channel-menu", {
            template: "#channel-menu",
            props: {channel: LichatChannel},
            data: ()=>{
                return {
                    showInvite: false,
                    showInfo: false,
                    showPause: false,
                    showChannelCreate: false,
                    showChannelList: false,
                    showUserList: false,
                    showPermissions: false
                };
            },
            mounted: function(){
                document.addEventListener('click', (ev)=>{
                    this.$emit('close');
                });
            }
        });

        Vue.component("message-menu", {
            template: "#message-menu",
            props: {message: LichatMessage},
            data: ()=>{
                return {
                    showInfo: false
                };
            },
            methods: {
                copy: function(){
                    navigator.clipboard.writeText(this.message.text)
                        .then(()=>console.log('Copied message to clipboard'))
                        .catch((e)=>lichat.errorMessage = ""+e);
                    this.$emit('close');
                },
                kick: function(){
                    this.message.channel.s("KICK", {target: this.message.from})
                        .catch((e)=>this.message.channel.showStatus("Error: "+e.text));
                    this.$emit('close');
                },
                quiet: function(){
                    this.message.channel.s("QUIET", {target: this.message.from})
                        .catch((e)=>this.message.channel.showStatus("Error: "+e.text))
                        .then((e)=>this.message.channel.showStatus(this.message.from+" has been quieted."));
                    this.$emit('close');
                },
                unquiet: function(){
                    this.message.channel.s("UNQUIET", {target: this.message.from})
                        .catch((e)=>this.message.channel.showStatus("Error: "+e.text))
                        .then((e)=>this.message.channel.showStatus(this.message.from+" has been quieted."));
                    this.$emit('close');
                }
            },
            mounted: function(){
                document.addEventListener('click', (ev)=>{
                    this.$emit('close');
                });
            }
        });

        Vue.component("client-menu", {
            template: "#client-menu",
            props: {client: LichatClient},
            data: ()=>{
                return {
                    showConfigure: false,
                    showChannelCreate: false
                };
            },
            mounted: function(){
                document.addEventListener('click', (ev)=>{
                    this.$emit('close');
                });
            }
        });

        Vue.component("client-configure", {
            template: "#client-configure",
            props: {client: Object},
            data: ()=>{
                return {
                    errorMessage: null
                };
            },
            methods: {
                remove: function(){
                    lichat.removeClient(this.client);
                    this.close();
                },
                create: function(){
                    let client = new LichatClient(this.client);
                    lichat.addClient(client)
                        .then(()=>this.close())
                        .catch((e)=>{
                            lichat.removeClient(client);
                            this.errorMessage = e.reason || e.text || "Failed to connect";
                        });
                },
                close: function(){
                    lichat.saveSetup();
                    this.$emit('close');
                }
            }
        });

        Vue.component("create-channel", {
            template: "#create-channel",
            props: {client: LichatClient},
            data: function(){
                return {
                    name: "",
                    anonymous: false,
                    errorMessage: null
                };
            },
            methods: {
                create: function(){
                    this.client.s("CREATE", {channel: (this.anonymous)?null:this.name})
                        .then(()=>this.$emit('close'))
                        .catch((e)=>this.errorMessage = e.text);
                }
            }
        });

        Vue.component("emote-picker", {
            template: "#emote-picker",
            props: {channel: LichatChannel, classes: Array},
            data: ()=>{
                return {
                    tab: 'emotes', 
                    allEmoji: LichatUI.allEmoji
                }; 
            },
            mounted: function(){
                twemoji.parse(this.$refs.emoji);
                Vue.nextTick(() => {
                    this.$refs.input.value = "";
                    this.$refs.input.focus();
                });
            },
            methods: {
                filter: function(ev){
                    let text = ev.target.value;
                    let group = (this.tab == 'emotes')? this.$refs.emotes :
                        (this.tab == 'emoji') ? this.$refs.emoji :
                        null;
                    if(group){
                        for(let i=0; i<group.children.length; i++){
                            let child = group.children[i];
                            child.style.display = child.getAttribute("title").includes(text)? "block" : "none";
                        }
                    }
                }
            }
        });

        Vue.component("message", {
            template: "#message",
            props: {message: LichatMessage},
            data: ()=>{
                return {
                    editText: null,
                    emotePicker: false,
                    showSettings: false,
                    showUserMenu: false
                };
            },
            methods: {
                react: function(emote){
                    this.emotePicker = false;
                    if(emote)
                        this.message.channel.s("REACT", {
                            target: this.message.from,
                            "update-id": this.message.id,
                            emote: emote
                        });
                },
                edit: function(){
                    this.editText = this.editText.trimEnd();
                    this.message.channel.s("EDIT", {
                        from: this.message.from,
                        id: this.message.id,
                        text: this.editText
                    }).then(()=>this.editText = null)
                        .catch((e)=>lichat.errorMessage = e.text);
                },
                replyTo: function(){
                    lichat.currentChannel.currentMessage.replyTo = this.message;
                },
                startEditing: function(){
                    this.editText = this.message.text;
                    Vue.nextTick(() => {
                        this.$refs.input.focus();
                    });
                }
            },
            mounted: function(){
                twemoji.parse(this.$el);
            }
        });

        this.app = new Vue({
            el: el || '.client',
            data: this,
            methods: {
                switchChannel: (channel)=>{
                    channel.unread = 0;
                    channel.alerted = false;
                    this.currentChannel = channel;
                    this.updateTitle();
                    Vue.nextTick(() => {
                        this.app.$refs.output.scrollTop = this.app.$refs.output.scrollHeight;
                        this.app.$refs.input.focus();
                        
                    });
                },
                toggleSearch: ()=>{
                    if(this.search===null){
                        this.search = "";
                        Vue.nextTick(() => {
                            this.app.$refs.search.focus();
                        });
                    }else{
                        this.search = null;
                        Vue.nextTick(() => {
                            this.app.$refs.input.focus();
                        });
                    }
                },
                submit: (ev)=>{
                    let channel = this.currentChannel;
                    let message = channel.currentMessage;
                    if(!ev.getModifierState("Control") && !ev.getModifierState("Shift")){
                        message.text = message.text.trimEnd();
                        if(message.text.startsWith("/")){
                            this.processCommand(message.text, channel);
                        }else{
                            channel.s("MESSAGE", {
                                "text": message.text,
                                "reply-to": (message.replyTo)? [message.replyTo.author.name, message.replyTo.id]: null
                            }).catch((e)=>channel.showStatus("Error: "+e.text));
                        }
                        message.clear();
                    }
                },
                uploadFile: (ev)=>{
                    if(ev.type == 'click'){
                        document.getElementById("fileChooser").click();
                    }else if(ev.type == 'change'){
                        if(ev.target.files)
                            this.app.uploadFile(ev.target.files);
                    }else if(ev.type == 'drop'){
                        if(ev.dataTransfer.files)
                            this.app.uploadFile(ev.dataTransfer.files);
                    }else if(ev instanceof FileList){
                        let chain = Promise.resolve(null);
                        for(let i=0; i<ev.length; ++i){
                            chain = chain.then(this.app.uploadFile(ev[i]));
                        }
                        return chain;
                    }else if(ev instanceof File){
                        let channel = this.currentChannel;
                        let message = channel.showStatus("Uploading "+ev.name);
                        var reader = new FileReader();
                        return new Promise((ok, fail)=>{
                            reader.onload = ()=>{
                                let parts = reader.result.match(/data:(.*?)(;base64)?,(.*)/);
                                this.currentChannel.s("DATA", {
                                    filename: ev.name,
                                    "content-type": parts[1],
                                    payload: parts[3]
                                }).then(()=>ok())
                                    .catch((ev)=>{
                                        channel.showStatus("Upload failed: "+ev.text);
                                        fail(ev);
                                    })
                                    .finally(()=>channel.deleteMessage(message));
                            };
                            reader.readAsDataURL(ev);
                        });
                    }
                    return null;
                },
                performSearch: (ev)=>{
                    let channel = this.currentChannel;
                    let query = this.search;
                    this.search = null;
                    this.currentChannel.s("SEARCH", {query: query})
                        .then((ev)=>this.showSearchResults(channel, ev.results, query))
                        .catch((e)=>channel.showStatus("Error: "+e.text));
                    ;
                },
                addEmote: (ev)=>{
                    this.showEmotePicker = false;
                    if(!ev in LichatUI.allEmoji) ev = ":"+ev+":";
                    if(ev) this.currentChannel.currentMessage.text += ev;
                }
            }
        });

        this.addCommand("help", (channel, subcommand)=>{
            if(subcommand){
                let command = this.commands["/"+subcommand];
                if(command){
                    let STRIP_COMMENTS = /(\/\/.*$)|(\/\*[\s\S]*?\*\/)|(\s*=[^,\)]*(('(?:\\'|[^'\r\n])*')|("(?:\\"|[^"\r\n])*"))|(\s*=[^,\)]*))/mg;
                    let ARGUMENT_NAMES = /([^\s,]+)/g;
                    function getParamNames(func) {
                        let fnStr = func.toString().replace(STRIP_COMMENTS, '');
                        let result = fnStr.slice(fnStr.indexOf('(')+1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
                        if(result === null)
                            result = [];
                        return result;
                    }
                    let arglist = getParamNames(command.handler);
                    channel.showStatus("/"+subcommand+" "+arglist.join(" ")+"\n\n"+command.help);
                }else{
                    channel.showStatus("No command named "+subcommand);
                }
            }else{
                let text = "<table><thead><tr><th>Command</th><th>Help</th></tr></thead><tbody>";
                for(let name in this.commands){
                    text += "<tr><td>"+name
                        +"</td><td>"+this.commands[name].help
                        +"</td></tr>";
                }
                text += "</tbody></table>";
                channel.showStatus(text, {html: true});
            }
        }, "Show help information on the available commands.");

        this.addCommand("disconnect", (channel)=>{
            channel.client.closeConnection();
            channel.showStatus("Disconnected.");
        }, "Disconnect the current client.");

        this.addCommand("join", (channel, ...name)=>{
            name = name.join(" ");
            channel.client.s("JOIN", {channel: name})
                .then(()=>{this.currentChannel = channel.client.getChannel(name);})
                .catch((e)=>channel.showStatus("Error: "+e.text));
        }, "Join a new channel.");

        this.addCommand("leave", (channel, ...name)=>{
            name = (0 < name.length)? name.join(" ") : channel.name;
            channel.client.s("LEAVE", {channel: name})
                .then(()=>{
                    channel.client.channelList = channel.client.channelList.filter(c => c !== channel);
                    if(channel == this.currentChannel){
                        this.currentChannel = null;
                    }
                }).catch((e)=>channel.showStatus("Error: "+e.text));
        }, "Leave a channel. If no channel is specified, leaves the current channel.");

        this.addCommand("create", (channel, ...name)=>{
            name = (0 < name.length)? name.join(" ") : null;
            channel.client.s("CREATE", {channel: name})
                .then(()=>{this.currentChannel = channel.client.getChannel(name);})
                .catch((e)=>channel.showStatus("Error: "+e.text));
        }, "Creates a new channel. If no name is specified, creates an anonymous channel.");

        this.addCommand("kick", (channel, ...name)=>{
            channel.s("KICK", {target: name.join(" ")})
                .catch((e)=>channel.showStatus("Error: "+e.text));
        }, "Kick a user fromde the channel.");
        
        this.addCommand("pull", (channel, ...name)=>{
            channel.s("PULL", {target: name.join(" ")})
                .catch((e)=>channel.showStatus("Error: "+e.text));
        }, "Pull a user into the channel.");

        this.addCommand("register", (channel, ...password)=>{
            channel.client.s("REGISTER", {password: password.join(" ")})
                .then(()=>channel.showStatus("Registration complete."))
                .catch((e)=>channel.showStatus("Error: "+e.text));
        }, "Try to register your current username with a password.");

        this.addCommand("grant", (channel, type, ...user)=>{
            channel.s("GRANT", {update: LichatReader.fromString(type), target: user.join(" ")})
                .then(()=>channel.showStatus("Permission granted."))
                .catch((e)=>channel.showStatus("Error: "+e.text));
        }, "Grant permission for an update type to another user in the channel.");

        this.addCommand("deny", (channel, type, ...user)=>{
            channel.s("DENY", {update: LichatReader.fromString(type), target: user.join(" ")})
                .then(()=>channel.showStatus("Permission denied."))
                .catch((e)=>channel.showStatus("Error: "+e.text));
        }, "Deny permission for an update type to another user in the channel.");

        // FIXME: missing commands from extensions, and also this is very repetitious...
    }

    addClient(client){
        if(this.clients.find(el => el.name == client)) 
            return false;

        client.showMenu = false;
        client.channelList = [];
        client.aliases = [];
        client.notificationLevel = 'all';

        client.getEmergencyChannel = ()=>{
            if(this.currentChannel && this.currentChannel.client == client){
                return this.currentChannel;
            }else if(0 < client.channelList.length){
                return client.channelList[0];
            }else{
                let channel = client.getChannel(client.servername || client.name);
                client.addToChannelList(channel);
                this.app.switchChannel(channel);
                return channel;
            }
        };

        client.disconnectHandler = (ev)=>{
            this.currentChannel.showStatus("Disconnected: "+(ev.reason || "connection lost"));
        };

        client.addHandler("CONNECT", (ev)=>{
            if(0 < client.channelList.length){
                client.getEmergencyChannel().showStatus("Connected");
            }
        });

        client.addHandler("JOIN", (ev)=>{
            ev.text = " ** Joined " + ev.channel;
            let channel = client.getChannel(ev.channel);
            channel.record(ev);
            if(client.getUser(ev.from.toLowerCase()).isSelf){
                client.addToChannelList(channel);
            }
            if(!this.currentChannel){
                this.app.switchChannel(channel);
            }
        });
        
        client.addHandler("LEAVE", (ev)=>{
            ev.text = " ** Left " + ev.channel;
            client.getChannel(ev.channel).record(ev);
        });

        this.clients.push(client);
        
        return client.openConnection();
    }

    removeClient(client){
        if(client.isConnected) client.closeConnection();
        let index = this.clients.indexOf(client);
        if(0 <= index){
            this.clients.splice(index, 1);
            this.saveSetup();
        }
    }

    addCommand(command, fun, help){
        this.commands["/"+command] = {
            handler: fun,
            help: help
        };
    }

    processCommand(cmdname, channel){
        try{
            let args = cmdname.split(" ");
            let command = this.commands[args[0]];
            if(!command) throw "No command named "+args[0];
            args[0] = channel;
            command.handler.apply(this, args);
        }catch(e){
            console.log(e);
            channel.showStatus("Error: "+e);
        }
    }

    showSearchResults(channel, results, query){
        
    }

    updateTitle(){
        let title = "Lichat";
        let count = 0;
        for(let client of this.clients){
            for(let channel of client.channelList){
                count += channel.unread;
            }
        }
        if(this.currentChannel)
            title = this.currentChannel.name+" | "+title;
        if(0 < count)
            title = "("+count+") "+title;
        document.title = title;
    }

    initialSetup(){
        this.addClient(new LichatClient(this.defaultClient))
            .catch((ev)=>client.getEmergencyChannel().showStatus("Connection failed "+(ev.reason || "")));
    }

    setupDatabase(){
        let ensureStore = (name, options)=>{
            if(!this.db.objectStoreNames.contains(name))
                this.db.createObjectStore(name, options);
        };
        ensureStore("clients", {keyPath: "name"});
        ensureStore("options", {keyPath: "name"});
    }

    loadSetup(){
        let tx = this.db.transaction(["clients","options"]);
        tx.onerror = (ev)=>console.log(ev);
        tx.objectStore("clients").getAll().onsuccess = (ev)=>{
            for(let options of ev.target.result){
                this.addClient(new LichatClient(options));
            }
        };
        tx.objectStore("options").get("general").onsuccess = (ev)=>{
            if(ev.target.result)
                this.options = ev.target.result;
        };
    }

    saveSetup(){
        if(!this.db) return;
        console.log("Saving...");
        let tx = this.db.transaction(["clients","options"], "readwrite");
        tx.onerror = (ev)=>console.log(ev);
        let store = tx.objectStore("clients");
        store.clear();
        for(let client of this.clients){
            store.put({
                name: client.name,
                username: client.username,
                password: client.password,
                hostname: client.hostname,
                port: client.port,
                ssl: client.ssl,
                aliases: client.aliases,
                channels: client.channelList.map(c => c.encode())
            });
        }
        tx.objectStore("options").put({
            name: "general",
            ...this.options
        });
        tx.commit();
    }

    clearSetup(){
        if(!this.db) return;
        let tx = this.db.transaction("clients", "readwrite");
        let store = tx.objectStore("clients");
        store.clear();
        tx.onerror = (ev)=>console.log(ev);
    }

    static allEmoji = {};

    static sound = new Audio('notify.mp3');
    
    // URL Regex by Diego Perini: https://gist.github.com/dperini/729294
    static URLRegex = new RegExp(
        "^" +
            // protocol identifier (optional)
        // short syntax // still required
        "(?:(?:(?:https?|ftp):)?\\/\\/)" +
            // user:pass BasicAuth (optional)
        "(?:\\S+(?::\\S*)?@)?" +
            "(?:" +
            // IP address exclusion
        // private & local networks
        "(?!(?:10|127)(?:\\.\\d{1,3}){3})" +
            "(?!(?:169\\.254|192\\.168)(?:\\.\\d{1,3}){2})" +
            "(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})" +
            // IP address dotted notation octets
        // excludes loopback network 0.0.0.0
        // excludes reserved space >= 224.0.0.0
        // excludes network & broadcast addresses
        // (first & last IP address of each class)
        "(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])" +
            "(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}" +
            "(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))" +
            "|" +
            // host & domain names, may end with dot
        // can be replaced by a shortest alternative
        // (?![-_])(?:[-\\w\\u00a1-\\uffff]{0,63}[^-_]\\.)+
        "(?:" +
            "(?:" +
            "[a-z0-9\\u00a1-\\uffff]" +
            "[a-z0-9\\u00a1-\\uffff_-]{0,62}" +
            ")?" +
            "[a-z0-9\\u00a1-\\uffff]\\." +
            ")+" +
            // TLD identifier name, may end with dot
        "(?:[a-z\\u00a1-\\uffff]{2,}\\.?)" +
            ")" +
            // port number (optional)
        "(?::\\d{2,5})?" +
            // resource path (optional)
        "(?:[/?#]\\S*)?" +
            "$", "i"
    );

    static linkifyURLs(text){
        let out = [];
        let word = [];
        let start = 0, cur = 0;

        let flushWord = ()=>{
            if(0 < word.length){
                let wordStr = word.join('');
                let unescaped = LichatUI.unescapeHTML(wordStr);
                word.length = 0;
                if(unescaped.match(LichatUI.URLRegex)){
                    out.push(`\u200B<a href="${unescaped}" class="userlink" target="_blank">${wordStr}</a>\u200B`);
                }else{
                    out.push(wordStr);
                }
            }
        };

        for(let char of text){
            // Note: unlike with 'of', text[n] would get only half of a wide unicode character
            if(char.match(/^\s$/)){
                if(start < cur){
                    flushWord();
                }
                start = cur + 1;
                out.push(char);
            }else{
                word.push(char);
            }
            cur++;
        }
        flushWord();
        return out.join('');
    }

    static unescapeHTML(text){
        return text.replace(/&([\w]+);/g, (a,b)=>{
            switch(b){
            case "lt": return "<";
            case "gt": return ">";
            case "quot": return "\"";
            case "amp": return "&";
            default: return a;
            }
        });
    }

    static escapeHTML(text){
        return text.replace(/([<>"&])/g, (a,b)=>{
            switch(b){
            case "<": return "&lt;";
            case ">": return "&gt;";
            case "\"": return "&quot;";
            case "&": return "&amp;";
            default: return a;
            }
        });
    }

    static markSelf(text, channel){
        let names = [...channel.client.aliases];
        if(channel.client.username)
            names.push(channel.client.username);
        let stream = new LichatStream();
        let inLink = false;
        for(let i=0; i<text.length; i++){
            let match = null;
            if(!inLink){
                for(let name of names){
                    if(text.substring(i, i+name.length) === name){
                        match = name;
                        break;
                    }
                }
            }
            if(match !== null){
                stream.writeString("<mark>"+match+"</mark>");
                i += match.length-1;
            }else{
                if(!inLink && text[i] === "<" && text[i+1] === "a"){
                    inLink = true;
                }else if(inLink && text[i] === ">"){
                    inLink = false;
                }
                stream.writeChar(text[i]);
            }
        }
        return stream.string;
    }

    static replaceEmotes(text, channel){
        // Find starting point
        let start = 0;        
        while(text[start] != ':' && start<text.length) start++;
        // If we do have colons in, scan for emotes.
        if(start < text.length){
            let out = text.slice(0, start);
            let end = start+1;
            // Scan for next colon
            for(; end<text.length; end++){
                if(text[end] == ':'){
                    let emote = text.slice(start, end+1);
                    // If we do have an emote of that name
                    let content = channel.getEmote(emote);
                    if(content){
                        out = out+"<img alt='"+emote+"' title='"+emote+"' src='"+content+"'>";
                        // Scan ahead for next possible end point after "skipping" the emote.
                        end++;
                        start = end;
                        while(text[end+1] != ':' && end<text.length) end++;
                    }else{
                        out = out+emote.slice(0, -1);
                        start = end;
                    }
                }
            }
            // Stitch on ending
            return out+text.slice(start, end);
        }else{
            return text;
        }
    }

    static formatUserText(text, channel){
        return LichatUI.replaceEmotes(LichatUI.markSelf(LichatUI.linkifyURLs(LichatUI.escapeHTML(text)), channel), channel);
    }
}


(()=>{
    let request = new XMLHttpRequest();
    request.onreadystatechange = ()=>{
        if(request.readyState === XMLHttpRequest.DONE && request.status == 200){
            LichatUI.allEmoji = JSON.parse(request.responseText);
        }
    };
    request.open('GET', 'https://cdn.jsdelivr.net/npm/emojilib@3.0.4/dist/emoji-en-US.json');
    request.send();
})();
