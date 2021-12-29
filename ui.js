class LichatUI{
    constructor(el, config){
        console.log("Setting up Lichat", config);
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
        this.embedded = config.embedded;
        this.showSideBar = !config.embedded;
        this.db = null;
        this.lastTypingUpdate = 0;
        this.defaultClientConfig = {...LichatDefaultClient};

        this.options = {
            transmitTyping: !this.embedded,
            showNotifications: !this.embedded,
            playSound: false,
            notificationLevel: 'mention',
            font: 'sans-serif',
            fontSize: '14',
            sidebarWidth: '15em',
        };

        this.autoComplete = {
            index: 0,
            prefix: null,
            pretext: null
        };

        if(config.connection){
            Object.assign(this.defaultClientConfig, config.connection);
            if(!config.connection.ssl)
                this.defaultClientConfig.ssl = (config.connection.port == LichatDefaultSSLPort);
        }

        if(!this.embedded){
            let DBOpenRequest = window.indexedDB.open("lichatjs", 5);
            DBOpenRequest.onerror = e=>{
                console.error(e);
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
        }else{
            this.defaultClientConfig.embedded = true;
            this.showClientMenu = true;
        }

        let mouseX = 0, mouseY = 0;
        document.addEventListener("mousemove", (ev)=>{
            mouseX = ev.clientX;
            mouseY = ev.clientY;
        });

        document.addEventListener("visibilitychange", ()=>{
            if(!document.hidden && this.currentChannel){
                this.currentChannel.unread = 0;
                this.currentChannel.alerted = false;
                this.updateTitle();
            }
        });

        let supersede = (object, field, newfun)=>{
            let original = object.prototype[field];
            object.prototype[field] = function(...args){
                let self = this;
                args.unshift((...args)=>original.apply(self, args));
                newfun.apply(this, args);
            };
        };

        supersede(LichatChannel, 'record', function(nextMethod, update, ignore){
            const [message, inserted] = nextMethod(update);
            if(ignore) return [message, inserted];

            lichat.saveMessage(this.client, message);

            let notify = inserted && !this.isPrimary;
            if(lichat.currentChannel == message.channel){
                let output = lichat.app.$refs.output;
                if(!output)
                    notify = false;
                else if(output.scrollTop === (output.scrollHeight - output.offsetHeight)){
                    if(!document.hidden) notify = false;
                    Vue.nextTick(() => {
                        let el = document.getElementById(message.gid);
                        if(el) el.scrollIntoView();
                    });
                }
            }
            if(notify) this.notify(message);
            return [message, inserted];
        });

        LichatChannel.prototype.notify = function(message){
            this.unread++;
            let notify = false;
            let level = this.notificationLevel;
            if(level == 'inherit' || !level)
                level = lichat.options.notificationLevel;
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
                    ev.notification.close();
                    if(ev.action != 'close'){
                        message.highlight();
                    }
                });
            }
            if(notify && lichat.options.playSound){
                LichatUI.sound.play();
            }
            lichat.updateTitle();
        };

        LichatMessage.prototype.markupText = function(text){
            return LichatUI.formatUserText(text, this.channel);
        };

        LichatMessage.prototype.highlight = function(){
            lichat.app.switchChannel(this.channel);
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
                lichat.saveSetup();
            }
        };

        LichatClient.prototype.removeFromChannelList = function(channel){
            let index = this.channelList.indexOf(channel);
            if(0 <= index){
                this.channelList.splice(index, 1);
                lichat.saveSetup();
            }
            if(channel == lichat.currentChannel){
                if(this.channelList.length <= index)
                    index = this.channelList.length-1;
                lichat.app.switchChannel(this.channelList[index]);
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

        let popup = {
            mounted: function(){
                document.addEventListener('click', (ev)=>{
                    this.$emit('close');
                });
                this.$el.style.left = mouseX+"px";
                this.$el.style.top = mouseY+"px";
                this.$nextTick(()=>{
                    this.fitInView();
                });
            },
            methods: {
                fitInView: function(){
                    let rect = this.$el.getBoundingClientRect();
                    if(rect.left < 0){
                        this.$el.style.right = "";
                        this.$el.style.left = "10px";
                    }
                    if(rect.top < 0){
                        this.$el.style.bottom = "";
                        this.$el.style.top = "10px";
                    }
                    if(window.innerWidth < rect.right){
                        this.$el.style.left = "";
                        this.$el.style.right = "10px";
                    }
                    if(window.innerHeight < rect.bottom){
                        this.$el.style.top = "";
                        this.$el.style.bottom = "10px";
                    }
                }
            }
        };

        let inputPopup = {
            data: function(){
                return {
                    errorMessage: ""
                };
            },
            mounted: function(){
                Vue.nextTick(() => {
                    let input = this.$el.querySelector("input");
                    if(input){
                        input.value = "";
                        input.focus();
                    }
                });
            }
        };

        Vue.component("self-menu", {
            template: "#self-menu",
            mixins: [popup],
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
            mixins: [popup],
            props: {user: LichatUser},
            data: ()=>{
                return {
                    showInvite: false,
                    showInfo: false
                };
            },
            methods: {
                whisper: function(){
                    this.user.client.s("create", {})
                        .then((e)=>this.user.client.s("pull", {
                            target: this.user.name,
                            channel: e.channel
                        })).catch((e)=>this.user.client.showStatus("Error: "+e.text));
                    this.$emit('close');
                },
                block: function(){
                    this.user.client.s("block", {target: this.message.from})
                        .then((e)=>this.user.client.showStatus(this.user.name+" has been blocked."))
                        .catch((e)=>this.user.client.showStatus("Error: "+e.text));
                    this.$emit('close');
                },
                unblock: function(){
                    this.user.client.s("unblock", {target: this.user.name})
                        .then((e)=>this.user.client.showStatus(this.user.name+" has been unblocked."))
                        .catch((e)=>this.user.client.showStatus("Error: "+e.text));
                    this.$emit('close');
                },
                ban: function(){
                    this.user.client.s("ban", {target: this.user.name})
                        .then((e)=>this.user.client.showStatus(this.user.name+" has been banned."))
                        .catch((e)=>this.user.client.showStatus("Error: "+e.text));
                    this.$emit('close');
                },
                unban: function(){
                    this.user.client.s("unban", {target: this.user.name})
                        .then((e)=>this.user.client.showStatus(this.user.name+" has been unbanned."))
                        .catch((e)=>this.user.client.showStatus("Error: "+e.text));
                    this.$emit('close');
                }
            }
        });

        Vue.component("channel-menu", {
            template: "#channel-menu",
            mixins: [popup],
            props: {channel: LichatChannel},
            data: ()=>{
                return {
                    showInvite: false,
                    showInfo: false,
                    showChannelCreate: false,
                    showChannelList: false,
                    showUserList: false
                };
            },
            methods: {
                invite: function(user){
                    if(user)
                        this.channel.s("pull", {target: user});
                    this.showInvite = false;
                    this.$emit('close');
                },
                leave: function(){
                    this.channel.s("leave")
                        .then(()=>this.channel.client.removeFromChannelList(this.channel));
                    this.$emit('close');
                },
                rules: function(){
                    
                }
            }
        });

        Vue.component("message-menu", {
            template: "#message-menu",
            mixins: [popup],
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
                    this.message.channel.s("kick", {target: this.message.from})
                        .catch((e)=>this.message.channel.showStatus("Error: "+e.text));
                    this.$emit('close');
                },
                quiet: function(){
                    this.message.channel.s("quiet", {target: this.message.from})
                        .catch((e)=>this.message.channel.showStatus("Error: "+e.text))
                        .then((e)=>this.message.channel.showStatus(this.message.from+" has been quieted."));
                    this.$emit('close');
                },
                unquiet: function(){
                    this.message.channel.s("unquiet", {target: this.message.from})
                        .catch((e)=>this.message.channel.showStatus("Error: "+e.text))
                        .then((e)=>this.message.channel.showStatus(this.message.from+" has been quieted."));
                    this.$emit('close');
                }
            }
        });

        Vue.component("client-menu", {
            template: "#client-menu",
            mixins: [popup],
            props: {client: LichatClient},
            data: ()=>{
                return {
                    showConfigure: false,
                    showChannelCreate: false
                };
            }
        });

        Vue.component("client-configure", {
            template: "#client-configure",
            mixins: [inputPopup],
            props: {client: Object},
            data: ()=>{
                return {
                    options: this.defaultClient,
                    tab: 'settings',
                    aliases: "",
                    bans: [],
                    ipBans: []
                };
            },
            created: function(){
                if(this.client){
                    Object.assign(this.options, this.client);
                    this.options.aliases = this.client.aliases.join("  ");
                    if(this.client.isConnected){
                        if(this.client.isPermitted('ban')){
                            this.client.s("blacklist", {})
                                .then((ev)=>this.bans = ev.target)
                                .catch((ev)=>this.errorMessage = ev.text);
                        }
                        if(this.client.isPermitted('ip-ban'))
                            this.client.s("ip-blacklist", {})
                                .then((ev)=>this.ipBans = ev.target)
                                .catch((ev)=>this.errorMessage = ev.text);
                    }
                }
                if(this.options.autoconnect){
                    this.create();
                }
            },
            methods: {
                remove: function(){
                    lichat.removeClient(this.client);
                    this.close();
                },
                submit: function(){
                    if(this.client instanceof LichatClient)
                        this.save();
                    else
                        this.create();
                },
                create: function(){
                    let client = new LichatClient(this.options);
                    lichat.addClient(client)
                        .then(()=>{
                            if(this.options.channel){
                                client.s("join", {channel: this.options.channel})
                                    .then((e)=>lichat.app.switchChannel(client.getChannel(e.channel)));
                            }
                            lichat.saveSetup();
                            this.$emit('close');
                        })
                        .catch((e)=>{
                            lichat.removeClient(client);
                            this.errorMessage = e.reason || e.text || "Failed to connect";
                            let focus = (el)=>{
                                Vue.nextTick(()=>{
                                    el.classList.add("flash");
                                    el.focus();
                                });
                            };
                            if(cl.typep(e.update, 'invalid-password') || cl.typep(e, 'no-such-profile'))
                                focus(this.$refs.password);
                            if(cl.typep(e.update, 'username-taken'))
                                focus(this.$refs.username);
                            if(cl.typep(e.update, 'bad-name'))
                                focus(this.$refs.username);
                        });
                },
                close: function(){
                    if(!this.options.embedded)
                        this.$emit('close');
                },
                save: function(){
                    this.client.name = this.options.name;
                    this.client.aliases = this.options.aliases.split("  ");
                    this.client.username = this.options.username;
                    this.client.password = this.options.password;
                    this.client.hostname = this.options.hostname;
                    this.client.port = this.options.port;
                    this.client.ssl = this.options.ssl;
                    lichat.saveSetup();
                    this.$emit('close');
                },
                deleteBan: function(ev){
                    this.client.s("unban", {target: ev.target.closest("a").getAttribute("name")})
                        .then((ev)=>this.bans = this.bans.filter((name)=>name !== ev.target))
                        .catch((ev)=>this.errorMessage = ev.text);
                },
                addBan: function(ev){
                    this.client.s("ban", {target: this.$refs.name.value})
                        .then((ev)=>{
                            this.bans.push(ev.target);
                            this.$refs.name.value = '';
                        })
                        .catch((ev)=>this.errorMessage = ev.text);
                },
                deleteIpBan: function(ev){
                    this.client.s("ip-unban", {ip: ev.target.closest("a").getAttribute("ip"),
                                               mask: ev.target.closest("a").getAttribute("mask")})
                        .then((ev)=>this.client.s("ip-blacklist"))
                        .then((ev)=>this.ipBans = ev.target)
                        .catch((ev)=>this.errorMessage = ev.text);
                },
                addIpUnban: function(ev){
                    this.client.s("ip-unban", {ip: this.$refs.ip.value, mask: this.$refs.mask.value})
                        .then((ev)=>{
                            this.$refs.ip.value = '';
                            this.$refs.mask.value = '';
                            return this.client.s("ip-blacklist");
                        })
                        .then((ev)=>this.ipBans = ev.target)
                        .catch((ev)=>this.errorMessage = ev.text);
                    this.$refs.name.value = '';
                },
                addIpBan: function(ev){
                    this.client.s("ip-ban", {ip: this.$refs.ip.value, mask: this.$refs.mask.value})
                        .then((ev)=>{
                            this.$refs.ip.value = '';
                            this.$refs.mask.value = '';
                            return this.client.s("ip-blacklist");
                        })
                        .then((ev)=>this.ipBans = ev.target)
                        .catch((ev)=>this.errorMessage = ev.text);
                },
            }
        });

        Vue.component('ui-configure', {
            template: "#ui-configure",
            mixins: [inputPopup],
            props: {options: Object},
            data: ()=>{
                let it = document.fonts.entries();
                let fonts = [];
                while(true){
                    let font = it.next();
                    if(font.done){
                        break;
                    }else{
                        fonts.push(font.value[0].family);
                    }
                }
                let knownFonts = ['Arial','Calibri','Comic Sans MS','Consolas','Courier New'];
                for(let font of knownFonts)
                    if(document.fonts.check("12px "+font))
                        fonts.push(font);

                fonts = [...new Set(fonts)].sort();
                fonts.unshift('serif');
                fonts.unshift('monospace');
                fonts.unshift('sans-serif');
                
                return {
                    havePermission: Notification.permission === 'granted',
                    fonts: fonts
                };
            },
            mounted: function(){
                this.$el.querySelector("input").focus();
            },
            methods: {
                requestPermission: function(){
                    Notification.requestPermission()
                        .then((permission)=>{
                            switch(permission){
                            case 'granted': this.havePermission = true; break;
                            case 'denied': this.errorMessage = "Lichat cannot show desktop notifications unless you grant permission."; break;
                            }});
                },
                close: function(){
                    lichat.saveSetup();
                    this.$emit('close');
                }
            }
        });

        Vue.component("select-user", {
            template: "#select-user",
            mixins: [inputPopup],
            props: {client: LichatClient},
            data: function(){
                return {
                    users: [],
                };
            },
            created: function(){
                this.users = Object.keys(this.client.users);
            }
        });

        Vue.component("create-channel", {
            template: "#create-channel",
            mixins: [inputPopup],
            props: {client: LichatClient, channel: Object},
            data: function(){
                return {
                    name: "",
                    anonymous: false
                };
            },
            created: function(){
                if(this.channel)
                    this.name = this.channel.name+"/";
            },
            mounted: function(){
                this.$el.querySelector("input").focus();
            },
            methods: {
                create: function(){
                    this.client.s("create", {channel: (this.anonymous)?null:this.name})
                        .then(()=>this.$emit('close'))
                        .catch((e)=>this.errorMessage = e.text);
                }
            }
        });

        Vue.component("list-users", {
            template: "#list-users",
            mixins: [inputPopup],
            props: {channel: LichatChannel},
            data: ()=>{
                return {
                    userList: [],
                    userMenu: null
                };
            },
            created: function(){
                this.filter();
            },
            methods: {
                filter: function(){
                    let filter = (this.$refs.input)? this.$refs.input.value : "";
                    filter = filter.toLowerCase();
                    let list = [];
                    for(let user of Object.values(this.channel.users)){
                        if(user.name.includes(filter))
                            list.push(user);
                    }
                    this.userList = list.sort();;
                }
            }
        });

        Vue.component("emote-picker", {
            template: "#emote-picker",
            mixins: [popup, inputPopup],
            props: {channel: LichatChannel, classes: Array},
            data: ()=>{
                return {
                    tab: 'emotes', 
                    allEmoji: LichatUI.allEmoji
                }; 
            },
            mounted: function(){
                twemoji.parse(this.$refs.emoji);
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

        let configureWidget = {
            data: ()=>{
                return {
                    tab: 'info',
                    errorMessage: null,
                    info: {}
                };
            },
            created: function(){
                Object.assign(this.info, this.object.info);
            },
            methods: {
                isImage: function(key){
                    return key === ':icon';
                },
                toURL: function(value){
                    if(!value) return EmptyIcon;
                    else{
                        let parts = value.split(" ");
                        return "data:"+parts[0]+";base64,"+parts[1];
                    }
                },
                setImage: function(ev){
                    let key = ev.target.getAttribute("name");
                    let onFile = ()=>{
                        this.$refs.file.removeEventListener('change', onFile);
                        let file = this.$refs.file.files[0];
                        if(file){
                            var reader = new FileReader();
                            reader.onload = ()=>{
                                let parts = reader.result.match(/data:(.*?)(;base64)?,(.*)/);
                                this.info[key] = parts[1]+" "+parts[3];
                            };
                            reader.readAsDataURL(file);
                        }
                    };
                    this.$refs.file.addEventListener('change', onFile);
                    this.$refs.file.click();
                },
                saveInfo: function(){
                    for(let key in this.info){
                        let value = this.info[key];
                        if(value !== this.object.info[key]){
                            this.object.s(this.setInfoUpdate, {key: LichatReader.fromString(key), text: value})
                                .then((e)=>this.object.info[key] = e.text)
                                .catch((e)=>this.errorMessage = e.text);
                        }
                    }
                },
            }
        };

        Vue.component("user-configure", {
            template: "#user-configure",
            mixins: [configureWidget],
            props: {user: LichatUser},
            data: ()=>{
                return {
                    registered: false,
                    connections: 0,
                    channels: [],
                    registeredOn: [],
                    connectionInfo: []
                };
            },
            computed: {
                object: function(){return this.user;},
                setInfoUpdate: ()=>"set-user-info"
            },
            created: function(){
                for(let channel of this.user.client.channelList){
                    if(channel.hasUser(this.user))
                        this.channels.push(channel.name);
                }
                if(this.user.client.isPermitted('user-info'))
                    this.user.s('user-info')
                    .then((ev)=>{
                        this.registered = ev.registered;
                        this.connections = ev.connections;
                        Object.assign(this.info, this.user.info);
                    })
                    .catch((ev)=>this.errorMessage = ev.text);
                if(this.user.client.isPermitted('server-info'))
                    this.user.s('server-info')
                    .then((ev)=>{
                        for(let entry of ev.attributes){
                            if(entry[0] == cl.intern("channels", "lichat")){
                                this.channels = entry[1];
                            }else if(entry[0] == cl.intern("registered-on", "lichat")){
                                this.registeredOn = cl.universalToUnix(entry[1]);
                            }
                        }
                        this.connectionInfo = [];
                        for(let connection of ev.connections){
                            let info = {};
                            for(let entry of connection){
                                if(entry[0] == cl.intern("connected-on", "lichat")){
                                    info.connectedOn = cl.universalToUnix(entry[1]);
                                }else if(entry[0] == cl.intern("ip", "shirakumo")){
                                    info.ip = entry[1];
                                }else if(entry[0] == cl.intern("ssl", "shirakumo")){
                                    info.ssl = entry[1];
                                }
                            }
                            this.connectionInfo.push(info);
                        }
                    })
                    .catch((ev)=>this.errorMessage = ev.text);
            },
            methods: {
                kill: function(){
                    this.user.s("kill")
                        .then(()=>this.$emit('close'))
                        .catch((ev)=>this.errorMessage = ev.text);
                }
            }
        });

        Vue.component("channel-configure", {
            template: "#channel-configure",
            mixins: [configureWidget],
            props: {channel: LichatChannel},
            data: ()=>{
                return {
                    emotes: [],
                    permissions: []
                };
            },
            created: function(){
                for(let name in this.channel.emotes){
                    this.emotes.push([name, this.channel.emotes[name]]);
                }
                this.emotes.sort((a,b)=>(a[0]<b[0])?-1:+1);
                if(this.channel.isPermitted("permissions"))
                    this.channel.s("permissions")
                    .then((e)=>{
                        for(let expr of e.permissions){
                            let rule = {
                                update: LichatPrinter.toString(expr[0]),
                                type: '',
                                users: [],
                            };
                            if(expr[1] === true)
                                rule.type = '-';
                            else if(expr[1] === null)
                                rule.type = '+';
                            else{
                                rule.type = expr[1][0].name;
                                rule.users = expr[1].slice(1);
                            }
                            this.permissions.push(rule);
                        }
                    })
                    .catch((e)=>this.errorMessage = e.text);
            },
            computed: {
                object: function(){return this.channel;},
                setInfoUpdate: ()=>"set-channel-info"
            },
            methods: {
                deleteEmote: function(ev){
                    let name = ev.target.closest("a").getAttribute("name");
                    this.channel.s("emote", {"content-type": "image/png", name: name, payload: ""})
                        .then((e)=>this.emotes = this.emotes.filter((o)=>o[0] !== e.name))
                        .catch((e)=>this.errorMessage = e.text);
                },
                uploadEmote: function(ev){
                    let file = this.$refs.file.files[0];
                    let name = this.$refs.name.value;
                    if(!file){
                        this.errorMessage = "Need to select a file.";
                        return;
                    }
                    if(!name){
                        this.errorMessage = "Need a name.";
                        return;
                    }
                    var reader = new FileReader();
                    reader.onload = ()=>{
                        let parts = reader.result.match(/data:(.*?)(;base64)?,(.*)/);
                        this.channel.s("emote", {
                            name: name,
                            "content-type": parts[1],
                            payload: parts[3]
                        }).then((ev)=>{
                            this.emotes.push([ev.name, this.toURL(ev["content-type"]+" "+ev.payload)]);
                            this.emotes.sort((a,b)=>(a[0]<b[0])?-1:+1);
                        })
                            .catch((e)=>this.errorMessage = e.text);
                    };
                    reader.readAsDataURL(file);
                },
                addUser: function(ev, rule){
                    if(ev.target.value !== '')
                        cl.pushnew(ev.target.value, rule.users);
                    ev.target.value='';
                },
                savePermissions: function(){
                    let expr = [];
                    for(let rule of this.permissions){
                        expr.push([LichatReader.fromString(rule.update),
                                   [cl.intern(rule.type, "lichat"), ...rule.users]]);
                    }
                    this.channel.s("permissions", {permissions: expr})
                        .catch((e)=>this.errorMessage = e.text);
                },
                toggleSlowMode: function(){
                    this.channel.s("pause", {by: Integer.parseInt(this.$refs.pause.value)})
                        .catch((ev)=>this.errorMessage = ev.text);
                },
                destroy: function(ev){
                    this.channel.s("destroy")
                        .then(()=>this.$emit('close'))
                        .catch((ev)=>this.errorMessage = ev.text);
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
                        this.message.channel.s("react", {
                            target: this.message.from,
                            "update-id": this.message.id,
                            emote: emote
                        });
                },
                edit: function(){
                    this.editText = this.editText.trimEnd();
                    this.message.channel.s("edit", {
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
                isConnected(client){
                    return client._socket && client._reconnectAttempts == 0;
                },
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
                handleKeypress: (ev)=>{
                    if(ev.keyCode === 9){
                        ev.preventDefault();
                        this.currentChannel.currentMessage.text = this.autoCompleteInput(this.currentChannel.currentMessage.text);
                    }else{
                        this.autoComplete.prefix = null;
                        if(this.options.transmitTyping && this.currentChannel.client.isAvailable("shirakumo-typing")
                           && this.lastTypingUpdate+4 < cl.getUniversalTime() && this.currentChannel.isPermitted('TYPING')){
                            this.lastTypingUpdate = cl.getUniversalTime();
                            this.currentChannel.s("typing", {}, true);
                        }
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
                            channel.s("message", {
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
                                this.currentChannel.s("data", {
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
                    this.currentChannel.s("search", {query: query})
                        .then((ev)=>this.showSearchResults(channel, ev.results, query))
                        .catch((e)=>channel.showStatus("Error: "+e.text));
                },
                addEmote: (emote)=>{
                    this.showEmotePicker = false;
                    if(emote){
                        if(!(emote in LichatUI.allEmoji)) emote = ":"+emote+":";
                        this.currentChannel.currentMessage.text += emote;
                        this.app.$refs.input.focus();
                    }
                }
            }
        });

        this.addCommand("help", (channel, subcommand)=>{
            if(subcommand){
                let command = this.commands["/"+subcommand];
                if(command){
                    let arglist = getParamNames(command.handler);
                    channel.showStatus("/"+subcommand+" "+arglist.join(" ")+"\n\n"+command.help);
                }else{
                    channel.showStatus("No command named "+subcommand);
                }
            }else{
                let text = "<table><thead><tr><th>Command</th><th>Help</th></tr></thead><tbody>";
                for(let name in this.commands){
                    text += "<tr><td>"+name+
                        "</td><td>"+this.commands[name].help+
                        "</td></tr>";
                }
                text += "</tbody></table>";
                channel.showStatus(text, {html: true});
            }

            let STRIP_COMMENTS = /(\/\/.*$)|(\/\*[\s\S]*?\*\/)|(\s*=[^,\)]*(('(?:\\'|[^'\r\n])*')|("(?:\\"|[^"\r\n])*"))|(\s*=[^,\)]*))/mg;
            let ARGUMENT_NAMES = /([^\s,]+)/g;
            function getParamNames(func) {
                let fnStr = func.toString().replace(STRIP_COMMENTS, '');
                let result = fnStr.slice(fnStr.indexOf('(')+1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
                if(result === null)
                    result = [];
                return result;
            }
        }, "Show help information on the available commands.");

        this.addCommand("disconnect", (channel)=>{
            channel.client.closeConnection();
            channel.showStatus("Disconnected.");
        }, "Disconnect the current client.");

        this.addCommand("join", (channel, ...name)=>{
            name = name.join(" ");
            if(channel.client.hasChannel(name) && channel.client.getChannel(name).isPresent){
                this.app.switchChannel(channel.client.getChannel(name));
            }else{
                channel.client.s("join", {channel: name})
                    .then(()=>this.app.switchChannel(channel.client.getChannel(name)))
                    .catch((e)=>channel.showStatus("Error: "+e.text));
            }
        }, "Join a new channel.");

        this.addCommand("leave", (channel, ...name)=>{
            name = (0 < name.length)? name.join(" ") : channel.name;
            channel.client.s("leave", {channel: name})
                .then(()=>channel.client.removeFromChannelList(channel))
                .catch((e)=>channel.showStatus("Error: "+e.text));
        }, "Leave a channel. If no channel is specified, leaves the current channel.");

        this.addCommand("create", (channel, ...name)=>{
            name = (0 < name.length)? name.join(" ") : null;
            channel.client.s("create", {channel: name})
                .then(()=>this.app.switchChannel(channel.client.getChannel(name)))
                .catch((e)=>channel.showStatus("Error: "+e.text));
        }, "Creates a new channel. If no name is specified, creates an anonymous channel.");

        this.addCommand("kick", (channel, ...name)=>{
            channel.s("kick", {target: name.join(" ")})
                .catch((e)=>channel.showStatus("Error: "+e.text));
        }, "Kick a user fromde the channel.");
        
        this.addCommand("pull", (channel, ...name)=>{
            channel.s("pull", {target: name.join(" ")})
                .catch((e)=>channel.showStatus("Error: "+e.text));
        }, "Pull a user into the channel.");

        this.addCommand("register", (channel, ...password)=>{
            password = password.join(" ");
            channel.client.s("register", {password: password})
                .then(()=>{
                    channel.client.password = password;
                    channel.showStatus("Registration complete.");
                })
                .catch((e)=>channel.showStatus("Error: "+e.text));
        }, "Try to register your current username with a password.");

        this.addCommand("grant", (channel, type, ...user)=>{
            channel.s("grant", {update: LichatReader.fromString(type), target: user.join(" ")})
                .then(()=>channel.showStatus("Permission granted."))
                .catch((e)=>channel.showStatus("Error: "+e.text));
        }, "Grant permission for an update type to another user in the channel.");

        this.addCommand("deny", (channel, type, ...user)=>{
            channel.s("deny", {update: LichatReader.fromString(type), target: user.join(" ")})
                .then(()=>channel.showStatus("Permission denied."))
                .catch((e)=>channel.showStatus("Error: "+e.text));
        }, "Deny permission for an update type to another user in the channel.");

        // FIXME: missing commands from extensions, and also this is very repetitious...
    }

    get defaultClient(){
        if(this.clients.length == 0){
            return {...this.defaultClientConfig};
        }else{
            let template = this.clients[0];
            return {
                name: "",
                username: template.username,
                password: "",
                aliases: template.aliases,
                hostname: "",
                port: LichatDefaultSSLPort,
                ssl: true
            };
        }
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
            }else if(client.servername){
                return client.getChannel(client.servername);
            }else{
                return {showStatus: ()=>{}};
            }
        };

        client.disconnectHandler = (ev)=>{
            this.currentChannel.showStatus("Disconnected: "+(ev.reason || ev.text || "connection lost"));
        };

        client.addHandler("connect", (ev)=>{
            if(0 < client.channelList.length){
                client.getEmergencyChannel().showStatus("Connected");
            }
        });

        client.addHandler("join", (ev)=>{
            ev.text = " ** Joined " + ev.channel;
            let channel = client.getChannel(ev.channel);
            channel.record(ev);
            if(client.getUser(ev.from.toLowerCase()).isSelf){
                client.addToChannelList(channel);

                if(channel.isPrimary){
                    this.loadMessages(client);
                }else if(client.isAvailable("shirakumo-backfill") && !this.embedded){
                    let since = null;
                    if(0 < channel.messageList.length)
                        since = cl.unixToUniversal(channel.messageList[channel.messageList.length-1].timestamp);
                    channel.s("BACKFILL", {since: since}, true);
                }
            }
            if(!this.currentChannel){
                this.app.switchChannel(channel);
            }
        });
        
        client.addHandler("leave", (ev)=>{
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
        // FIXME: delete saved messages
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
            console.error(e);
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

    initialSetup(client){
        return this.addClient(new LichatClient(client || this.defaultClient))
            .catch((ev)=>client.getEmergencyChannel().showStatus("Connection failed "+(ev.reason || "")));
    }

    setupDatabase(){
        let ensureStore = (name, options)=>{
            if(!this.db.objectStoreNames.contains(name)){
                return this.db.createObjectStore(name, options);
            }else{
                return {createIndex: ()=>{}};
            }
        };
        ensureStore("clients", {keyPath: "name"});
        ensureStore("options", {keyPath: "name"});
        ensureStore("messages", {keyPath: "gid"}).createIndex("server", "server");
    }

    loadSetup(){
        let tx = this.db.transaction(["clients","options"]);
        tx.onerror = (ev)=>console.error(ev);
        tx.objectStore("clients").getAll().onsuccess = (ev)=>{
            for(let options of ev.target.result){
                let client = new LichatClient(options);
                this.addClient(client)
                    .catch((ev)=>client.getEmergencyChannel().showStatus("Connection failed "+(ev.reason || "")));
            }
        };
        tx.objectStore("options").get("general").onsuccess = (ev)=>{
            if(ev.target.result)
                this.options = ev.target.result;
        };
    }

    saveMessage(client, message){
        if(!this.db) return;
        if(message.isSystem) return;
        if(message.channel.isPrimary) return;
        let tx = this.db.transaction(["messages"], "readwrite");
        tx.onerror = (ev)=>console.error(ev);
        tx.objectStore("messages")
            .put({
                gid: message.gid,
                id: message.id,
                from: message.from,
                bridge: message.author.name,
                channel: message.channel.name,
                text: message.text,
                clock: cl.unixToUniversal(message.timestamp),
                type: message.type,
                link: message.contentType,
                server: client.servername
            });
    }

    loadMessages(client){
        if(!this.db) return;
        console.log("Loading messages for", client);
        let tx = this.db.transaction(["messages"]);
        tx.onerror = (ev)=>console.error(ev);
        tx.objectStore("messages")
            .index("server")
            .openCursor(IDBKeyRange.only(client.servername))
            .onsuccess = (ev)=>{
                let cursor = event.target.result;
                if(!cursor) return;
                let data = cursor.value;
                let channel = client.getChannel(data.channel);
                channel.record(data, true);
                cursor.continue();
            };
    }

    saveSetup(){
        if(!this.db) return;
        console.log("Saving...");
        let tx = this.db.transaction(["clients","options"], "readwrite");
        tx.onerror = (ev)=>console.error(ev);
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
        tx.onerror = (ev)=>console.error(ev);
    }

    autoCompleteInput(text){
        // FIXME: this is not a very good auto-completer, as it chokes on completions with spaces.
        let ac = this.autoComplete;
        if(ac.prefix === null){
            ac.index = 0;
            ac.prefix = text.split(" ").splice(-1)[0].toLowerCase();
            ac.pretext = text.substr(0, text.length-ac.prefix.length);
        }
        
        var matches = [];
        for(let user of this.currentChannel.getUserList()){
            if(user.toLowerCase().indexOf(ac.prefix) === 0 &&
               user !== this.currentChannel.client.username)
                matches.push(user);
        }
        for(let emote of this.currentChannel.getEmoteList()){
            emote = ":"+emote+":";
            if(emote.toLowerCase().indexOf(ac.prefix) === 0)
                matches.push(emote);
        }
        if(0 < matches.length){
            matches.sort();
            let match = matches[ac.index];
            ac.index = (ac.index+1)%matches.length;
            return ac.pretext+match
                + ((ac.pretext === "" && match[match.length-1] !== ":")? ": ": " ");
        }
        return text;
    }

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
LichatUI.allEmoji = {};
LichatUI.sound = new Audio('notify.mp3');
// URL Regex by Diego Perini: https://gist.github.com/dperini/729294
LichatUI.URLRegex = new RegExp(
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
