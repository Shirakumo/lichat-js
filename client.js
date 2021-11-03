var LichatDefaultPort = 1113;

class LichatUser{
    constructor(name, client){
        this._name = name;
        this._client = client;
        this.info = {};
    }

    get name(){
        return this._name;
    }

    get isPresent(){
        return this.isInChannel(this._client.servername);
    }

    isInChannel(channel){
        if(typeof(channel) === "string") channel = this._client.getChannel(channel);
        return channel.hasUser(this);
    }
}

class LichatChannel{
    constructor(name, client){
        this._name = name;
        this._client = client;
        this.wasJoined = false;
        this.users = {};
        this.info = {};
    }

    get name(){
        return this._name;
    }

    get isPresent(){
        return this.users[this._client.username()] !== undefined;
    }

    joinUser(user){
        if(typeof(user) === "string") user = this._client.getUser(user);
        if(user.name === this._client.username) this.wasJoined = true;
        this.users[user.name.toLowerCase()] = user;
        return user;
    }

    leaveUser(user){
        if(typeof(user) === "string") user = this._client.getUser(user);
        if(user.name === this._client.username) this.wasJoined = false;
        delete this.users[user.name.toLowerCase()];
        return user;
    }

    hasUser(user){
        if(user instanceof LichatUser) user = thing.name;
        return this.users[user.toLowerCase()] !== undefined;
    }

    clearUsers(){
        this.users = {};
    }

    s(type, args, cb){
        args["channel"] = this.name;
        return this._client.s(type, args, cb);
    }
};

class LichatClient{
    constructor(options){
        var self = this;

        options = options || {};
        if(!options.username) options.username = null;
        if(!options.password) options.password = null;
        if(!options.hostname) options.hostname = "localhost";
        if(!options.port) options.port = LichatDefaultPort;
        if(!options.handleFailure) options.handleFailure = ()=>{};

        for(var key in options){
            self[key] = options[key];
        }
        
        self.socket = null;
        self.servername = null;
        self.handlers = {};
        self.pingDelay = 15000;
        self.emotes = {};
        self.channels = {};
        self.users = {};
        self.ssl = false;

        if(window.localStorage){
            self.emotes = JSON.parse(window.localStorage.getItem("lichat-emotes")) || {};
        }

        var supportedExtensions = ["shirakumo-data", "shirakumo-backfill", "shirakumo-emotes",
                                   "shirakumo-channel-info", "shirakumo-quiet", "shirakumo-pause",
                                   "shirakumo-server-management", "shirakumo-ip", "shirakumo-user-info",
                                   "shirakumo-icon", "shirakumo-bridge", "shirakumo-block",
                                   "shirakumo-reactions", "shirakumo-link"];
        self.availableExtensions = [];
        self.internalHandlers = {};
        self.idCallbacks = {};
        self.reader = new LichatReader();
        self.printer = new LichatPrinter();
        self.status = null;
        self.pingTimer = null;
        self.reconnectAttempts = 0;

        self.addInternalHandler("CONNECT", (ev)=>{
            this.availableExtensions = ev.extensions;
            if(this.isAvailable("shirakumo-emotes")){
                var known = [];
                for(var emote in self.emotes){
                    cl.push(emote.replace(/^:|:$/g,""), known);
                }
                self.s("EMOTES", {names: known});
            }
        });

        self.addInternalHandler("PING", (ev)=>{
            self.s("PONG", {socket: ev.socket});
        });

        self.addInternalHandler("PONG", (ev)=>{
        });

        self.addInternalHandler("JOIN", (ev)=>{
            let channel = self.getChannel(ev.channel);
            channel.joinUser(ev.from);
            if(!self.servername){
                self.servername = ev.channel;

                for(let channel in self.channels){
                    let channel = self.channels[channel];
                    if(channel.wasJoined && channel.name != self.servername)
                        channel.s("JOIN");
                }
            }
            if(ev.from === self.username){
                var info = {};
                info[":NEWS"] = "";
                info[":TOPIC"] = "";
                info[":RULES"] = "";
                info[":CONTACT"] = "";
                channel.info = info;
                if(cl.find("shirakumo-backfill", self.availableExtensions)
                   && ev.channel !== self.servername){
                    self.s("BACKFILL", {channel: ev.channel});
                }
                if(cl.find("shirakumo-channel-info", self.availableExtensions)){
                    self.s("CHANNEL-INFO", {channel: ev.channel});
                }
            }
        });

        self.addInternalHandler("LEAVE", (ev)=>{
            let channel = self.getChannel(ev.channel);
            channel.leaveUser(ev.from);
        });

        self.addInternalHandler("EMOTE", (ev)=>{
            self.addEmote(ev);
        });

        self.addInternalHandler("SET-CHANNEL-INFO", (ev)=>{
            self.channels[ev.channel.toLowerCase()].info[LichatPrinter.toString(ev.key)] = ev.text;
        });
    }

    reconnect(){
        try{
            this.openConnection();
        }catch(e){
            this.scheduleReconnect();
        }
    };

    scheduleReconnect(){
        this.reconnectAttempts++;
        let secs = Math.pow(2, this.reconnectAttempts);
        setTimeout(()=>this.reconnect(), secs*1000);
    };

    openConnection(){
        this.status = "STARTING";
        var socket = new WebSocket((this.ssl?"wss://":"ws://")+this.hostname+":"+this.port, "lichat");
        socket.onopen = ()=>{
            this.s("CONNECT", {password: this.password || null,
                               version: LichatVersion,
                               extensions: supportedExtensions,
                               socket: socket});
        };
        socket.onmessage = (e)=>{this.handleMessage(socket, e);};
        socket.onclose = (e)=>{
            if(e.code !== 1000 && self.status != "STOPPING"){
                this.handleFailure(new Condition("SOCKET-CLOSE", {
                    text: "Error "+e.code+" "+e.reason,
                    socket: socket,
                    event: e
                }));
                this.scheduleReconnect();
            }else{
                this.closeConnection(socket);
            }
        };
        this.socket = socket;
        return socket;
    };

    closeConnection(socket){
        socket = socket || this.socket;
        for(let channel in this.channels){
            this.channels[channel].clearUsers();
        }
        if(self.status != "STOPPING"){
            self.status = "STOPPING";
            if(socket && socket.readyState < 2){
                socket.close();
            }
            if(this.socket == socket){ 
                this.socket = null;
            }
        }
        return socket;
    };

    send(socket, wireable){
        if(!socket || socket.readyState != 1)
            cl.error("NOT-CONNECTED",{text: "The client is not connected."});
        if(!cl.typep(wireable, "PING") && !cl.typep(wireable, "PONG"))
            cl.format("[Lichat] Send:~s", wireable);
        var stream = new LichatStream();
        this.printer.toWire(wireable, stream);
        socket.send(stream.string+'\u0000');
        return wireable;
    };

    s(type, args, cb){
        args = args || {};
        var socket = args.socket || this.socket;
        delete args.socket;
        if(!args.from) args.from = this.username;
        var update = cl.makeInstance(type, args);
        if(cb) this.addCallback(update.id, cb);
        return this.send(socket, update);
    };

    startDelayPing(socket){
        if(this.pingTimer) clearTimeout(this.pingTimer);
        this.pingTimer = setTimeout(()=>{
            if(socket.readyState == 1){
                this.s("PING", {socket: socket});
                this.startDelayPing(socket);
            }
        }, this.pingDelay);
        return this.pingTimer;
    };

    handleMessage(socket, event){
        try{
            var update = this.reader.fromWire(new LichatStream(event.data));
            this.startDelayPing(socket);
            update.socket = socket;
            switch(self.status){
            case "STARTING":
                try{
                    if(!(cl.typep(update, "WIRE-OBJECT")))
                        cl.error("CONNECTION-FAILED",{text: "non-Update message", update: update});
                    if(update.type !== "CONNECT")
                        cl.error("CONNECTION-FAILED",{text: update.text, update: update});
                }catch(e){
                    this.handleFailure(e);
                    this.closeConnection(socket);
                    throw e;
                }
                self.status = "RUNNING";
                if(!this.username)
                    this.username = update.from;
                if(0 < reconnectAttempts)
                    reconnectAttempts = 0;
                this.process(update);
                break;
            case "RUNNING":
                this.process(update);
                break;
            }
        }catch(e){
            cl.format("Error during message handling: ~s", e);
        }
        return this;
    };

    process(update){
        if(!cl.typep(update, "PING") && !cl.typep(update, "PONG"))
            cl.format("[Lichat] Update:~s",update);
        var callbacks = idCallbacks[update.id];
        if(callbacks){
            for(callback of callbacks){
                try{
                    callback(update);
                }catch(e){
                    cl.format("Callback error: ~s", e);
                }
            }
            this.removeCallback(update.id);
        }
        if(!this.maybeCallInternalHandler(update.type, update)){
            for(var s of cl.classOf(update).superclasses){
                if(this.maybeCallInternalHandler(s.className, update))
                    break;
            }
        }
        if(!this.maybeCallHandler(update.type, update)){
            for(var s of cl.classOf(update).superclasses){
                if(this.maybeCallHandler(s.className, update))
                    break;
            }
        }
        return this;
    };

    maybeCallInternalHandler(type, update){
        if(this.internalHandlers[type]){
            this.internalHandlers[type](update);
            return true;
        }
        return false;
    };

    addInternalHandler(update, handler){
        this.internalHandlers[update] = handler;
        return this;
    };

    removeInternalHandler(update){
        delete this.internalHandlers[update];
        return this;
    };

    maybeCallHandler(type, update){
        if(this.handlers[type]){
            this.handlers[type](update);
            return true;
        }
        return false;
    };

    addHandler(update, handler){
        this.handlers[update] = handler;
        return this;
    };

    removeHandler(update){
        delete this.handlers[update];
        return this;
    };

    addCallback(id, handler){
        if(!idCallbacks[id]){
            idCallbacks[id] = [handler];
        }else{
            idCallbacks[id].push(handler);
        }
        return this;
    };

    removeCallback(id){
        delete idCallbacks[id];
        return this;
    };

    getChannel(name){
        let channel = this.channels[name.toLowerCase()];
        if(channel === undefined){
            channel = new LichatChannel(name, this);
            this.channels[name.toLowerCase()] = channel;
        }
        return channel;
    };

    getUser(name){
        let user = this.users[name.toLowerCase()];
        if(user === undefined){
            user = new LichatUser(name, this);
            this.users[name.toLowerCase()] = user;
        }
        return user;
    }

    addEmote(emote){
        var name = ":"+emote["name"].toLowerCase().replace(/^:|:$/g,"")+":";
        this.emotes[name] = {contentType: emote["content-type"], payload: emote["payload"]};
        if(window.localStorage){
            window.localStorage.setItem("lichat-emotes", JSON.stringify(this.emotes));
        }
        return emote;
    };

    isAvailable(name){
        return cl.find(name, this.availableExtensions);
    };
};
