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
        this.emotes = {};
        this.info = {};
        this.info[":NEWS"] = "";
        this.info[":TOPIC"] = "";
        this.info[":RULES"] = "";
        this.info[":CONTACT"] = "";
    }

    get name(){
        return this._name;
    }

    get isPresent(){
        return this.users[this._client.username()] !== undefined;
    }

    get isPrimary(){
        return this._name == this._client.servername;
    }

    getEmote(name){
        return this.emotes[name.toLowerCase().replace(/^:|:$/g,"")];
    }

    getEmoteList(){
        return this.emotes.keys();
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

    s(type, args, noPromise){
        args = args || {};
        args["channel"] = this.name;
        return this._client.s(type, args, noPromise);
    }
};

class LichatClient{
    constructor(options){
        options = options || {};
        this.name = options.name;
        this.username = options.username;
        this.password = options.password;
        this.hostname = options.hostname || "localhost";
        this.port = options.port || LichatDefaultPort;
        this.ssl = options.ssl;
        this.disconnectHandler = ()=>{};
        this.servername = null;
        this.pingDelay = 15000;
        this.channels = {};
        this.users = {};

        this.supportedExtensions = ["shirakumo-data", "shirakumo-backfill", "shirakumo-emotes",
                                    "shirakumo-channel-info", "shirakumo-quiet", "shirakumo-pause",
                                    "shirakumo-server-management", "shirakumo-ip", "shirakumo-user-info",
                                    "shirakumo-icon", "shirakumo-bridge", "shirakumo-block",
                                    "shirakumo-reactions", "shirakumo-link"];
        this.availableExtensions = [];
        this._socket = null;
        this._handlers = {};
        this._internalHandlers = {};
        this._idCallbacks = {};
        this._reader = new LichatReader();
        this._printer = new LichatPrinter();
        this._pingTimer = null;
        this._reconnectAttempts = 0;

        this.addInternalHandler("CONNECT", (ev)=>{
            this.availableExtensions = ev.extensions;
        });

        this.addInternalHandler("PING", (ev)=>{
            this.s("PONG", {}, true);
        });

        this.addInternalHandler("PONG", (ev)=>{
        });

        this.addInternalHandler("JOIN", (ev)=>{
            let channel = this.getChannel(ev.channel);
            channel.joinUser(ev.from);

            if(!this.servername){
                this.servername = ev.channel;

                for(let channel in this.channels){
                    let channel = this.channels[channel];
                    if(channel.wasJoined && channel.name != this.servername)
                        channel.s("JOIN", {}, true);
                }
            }
            if(ev.from === this.username){
                if(this.isAvailable("shirakumo-backfill") && !channel.isPrimary)
                    this.s("BACKFILL", {channel: ev.channel}, true);
                if(this.isAvailable("shirakumo-channel-info"))
                    this.s("CHANNEL-INFO", {channel: ev.channel}, true);
                if(this.isAvailable("shirakumo-emotes"))
                    this.s("EMOTES", {channel: ev.channel, emotes: channel.getEmoteList()}, true);
            }
        });

        this.addInternalHandler("LEAVE", (ev)=>{
            let channel = this.getChannel(ev.channel);
            channel.leaveUser(ev.from);
        });

        this.addInternalHandler("EMOTE", (ev)=>{
            this.addEmote(ev);
        });

        this.addInternalHandler("SET-CHANNEL-INFO", (ev)=>{
            this.channels[ev.channel.toLowerCase()].info[LichatPrinter.toString(ev.key)] = ev.text;
        });
    }

    reconnect(){
        try{
            this.openConnection();
        }catch(e){
            this.scheduleReconnect();
        }
    }

    scheduleReconnect(){
        this._reconnectAttempts++;
        let secs = Math.pow(2, this._reconnectAttempts);
        setTimeout(()=>this.reconnect(), secs*1000);
    }

    openConnection(){
        return new Promise((ok, fail) => {
            this._socket = new WebSocket((this.ssl?"wss://":"ws://")+this.hostname+":"+this.port, "lichat");
            this._socket.onopen = ()=>{
                this.s("CONNECT", {
                    password: this.password || null,
                    version: LichatVersion,
                    extensions: this.supportedExtensions
                }, true);
            };
            this._socket.onmessage = (e)=>{
                let update = this._reader.fromWire(new LichatStream(event.data));
                try{
                    if(!(cl.typep(update, "WIRE-OBJECT")))
                        fail({text: "non-Update message", update: update});
                    else if(update.type !== "CONNECT")
                        fail({text: update.text, update: update});
                    else{
                    }
                }catch(e){
                    this.closeConnection();
                }
                if(!this.username)
                    this.username = update.from;
                if(0 < reconnectAttempts)
                    reconnectAttempts = 0;
                
                this._socket.onmessage = this.handleMessage;
                this._socket.onclose = this.handleClose;
                this.process(update);
                ok(this);
            };
            this._socket.onclose = (e)=>{
                fail(this, e);
            };
        });
    }

    closeConnection(){
        for(let channel in this.channels)
            this.channels[channel].clearUsers();
        if(this._socket && socket.readyState < 2){
            this._socket.onclose = ()=>{};
            this._socket.close();
        }
        this._socket = null;
        return this;
    }

    send(wireable){
        if(!this._socket || this._socket.readyState != 1)
            cl.error("NOT-CONNECTED",{text: "The client is not connected."});
        if(!cl.typep(wireable, "PING") && !cl.typep(wireable, "PONG"))
            cl.format("[Lichat] Send:~s", wireable);
        let stream = new LichatStream();
        this._printer.toWire(wireable, stream);
        this._socket.send(stream.string+'\u0000');
        return wireable;
    }

    s(type, args, noPromise){
        args = args || {};
        if(!args.from) args.from = this.username;
        let update = cl.makeInstance(type, args);
        if(noPromise) return this.send(update);
        return new Promise((ok, fail)=>{
            this.addCallback(update.id, (u) => {
                if(cl.typep(u, "FAILURE")) fail(u);
                else                       ok(u);
            }, fail);
            this.send(update);
        });
    }

    startDelayPing(){
        if(this._pingTimer) clearTimeout(this._pingTimer);
        this._pingTimer = setTimeout(()=>{
            if(this._socket.readyState == 1){
                this.s("PING", {}, true);
                this.startDelayPing();
            }
        }, this.pingDelay);
        return this._pingTimer;
    }

    handleMessage(event){
        try{
            let update = this._reader.fromWire(new LichatStream(event.data));
            this.startDelayPing();
            this.process(update);
        }catch(e){
            cl.format("Error during message handling: ~s", e);
        }
        return this;
    }

    handleClose(event){
        if(e.code !== 1000){
            this.disconnectHandler(e);
            this.scheduleReconnect();
        }else{
            this.closeConnection();
        }
    }

    processCallbacks(id, update){
        let callbacks = idCallbacks[id];
        if(callbacks){
            for(callback of callbacks){
                try{
                    callback.call(this, update);
                }catch(e){
                    cl.format("Callback error: ~s", e);
                }
            }
            this.removeCallback(id);
        }
    }

    process(update){
        if(!cl.typep(update, "PING") && !cl.typep(update, "PONG"))
            cl.format("[Lichat] Update:~s",update);
        if(cl.typep(update, "UPDATE-FAILURE"))
            this.processCallbacks(update["update-id"], update);
        else
            this.processCallbacks(update.id, update);
        if(!this.maybeCallInternalHandler(update.type, update)){
            for(let s of cl.classOf(update).superclasses){
                if(this.maybeCallInternalHandler(s.className, update))
                    break;
            }
        }
        if(!this.maybeCallHandler(update.type, update)){
            for(let s of cl.classOf(update).superclasses){
                if(this.maybeCallHandler(s.className, update))
                    break;
            }
        }
        return this;
    }

    maybeCallInternalHandler(type, update){
        if(this._internalHandlers[type]){
            this._internalHandlers[type](update);
            return true;
        }
        return false;
    }

    addInternalHandler(update, handler){
        this._internalHandlers[update] = handler;
        return this;
    }

    removeInternalHandler(update){
        delete this._internalHandlers[update];
        return this;
    }

    maybeCallHandler(type, update){
        if(this._handlers[type]){
            this._handlers[type](update);
            return true;
        }
        return false;
    }

    addHandler(update, handler){
        this._handlers[update] = handler;
        return this;
    }

    removeHandler(update){
        delete this._handlers[update];
        return this;
    }

    addCallback(id, handler){
        // FIXME: Add timeout mechanism
        if(!idCallbacks[id]){
            idCallbacks[id] = [handler];
        }else{
            idCallbacks[id].push(handler);
        }
        return this;
    }

    removeCallback(id, handler){
        if(handler && idCallbacks[id])
            idCallbacks[id] = idCallbacks[id].filter(item => item !== handler);
        else
            delete idCallbacks[id];
        return this;
    }

    getChannel(name){
        let channel = this.channels[name.toLowerCase()];
        if(channel === undefined){
            channel = new LichatChannel(name, this);
            this.channels[name.toLowerCase()] = channel;
        }
        return channel;
    }

    getUser(name){
        let user = this.users[name.toLowerCase()];
        if(user === undefined){
            user = new LichatUser(name, this);
            this.users[name.toLowerCase()] = user;
        }
        return user;
    }

    addEmote(emote){
        let name = emote["name"].toLowerCase().replace(/^:|:$/g,"");
        let channel = emote["channel"];

        if(emote["payload"]){
            let emote = {
                contentType: emote["content-type"],
                payload: emote["payload"],
                name: emote["name"]
            };
            getChannel(channel).emotes[name] = emote;
        }else{
            delete getChannel(channel).emotes[name];
        }
        return emote;
    }

    isAvailable(name){
        return cl.find(name, this.availableExtensions);
    }
};
