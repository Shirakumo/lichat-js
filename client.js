var LichatDefaultPort = 1113;
var LichatDefaultSSLPort = 1114;
var EmptyIcon = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

class LichatReaction{
    constructor(update, channel){
        this.text = update.emote;
        if(!allEmojiStrings.includes(update.emote)){
            let emote = channel.getEmote(update.emote);
            if(!emote) throw "Invalid emote.";
            this.image = emote;
        }
        this.users = [update.from];
    }

    get count(){
        return this.users.length;
    }

    get description(){
        return this.users.join(',')+" reacted with "+this.text;
    }
}

class LichatMessage{
    constructor(update, channel, options){
        options = options || {};
        this.id = update.id;
        this.from = update.from;
        this.author = channel.getUser(update.bridge || update.from);
        this.channel = channel;
        this.reactions = [];
        this.text = update.text || "";
        this.html = (options.html)? this.text: this.markupText(this.text);
        this.isSystem = options.system;
        this.gid = this.channel.name+"/"+update.id+"@"+this.author.name.toLowerCase();
        this.url = document.location.href.match(/(^[^#]*)/)[0]+"#"+this.gid;
        this.timestamp = cl.universalToUnix(update.clock);
        this.clock = new Date(this.timestamp*1000);
        this.type = update.type.toLowerCase();
        this.contentType = update.link || "text/plain";
        if(update["reply-to"])
            this.replyTo = channel.getMessage(update["reply-to"][0], update["reply-to"][1]);
        else
            this.replyTo = null;
    }

    get time(){
        let pad = (x)=>(x<10?"0":"")+x;
        return pad(this.clock.getHours())+":"+pad(this.clock.getMinutes());
    }

    get date(){
        return this.clock.toLocaleDateString()
            +", "+this.clock.toLocaleTimeString();
    }

    get isImage(){ return this.contentType.includes("image"); }

    get isVideo(){ return this.contentType.includes("video"); }

    get isAudio(){ return this.contentType.includes("audio"); }

    get isAlert(){
        // FIXME: todo
        return false;
    }

    get isVirtual(){
        return this.id === undefined;
    }

    get isBridged(){
        return this.author.name == this.from;
    }

    get shortText(){
        return this.text.split("\n")[0];
    }

    get text(){
        return this._text;
    }

    set text(text){
        this._text = text;
        this.html = this.markupText(text);
    }

    addReaction(update){
        let reaction = this.reactions.find(e => e.text == update.emote);
        if(!reaction){
            this.reactions.push(new LichatReaction(update, this.channel));
        }else if(reaction.users.includes(update.from)){
            reaction.users = reaction.users.filter(item => item !== update.from);
            if(reaction.users.length == 0)
                this.reactions = this.reactions.filter(item => item !== reaction);
        }else{
            reaction.users.push(update.from);
        }
        return reaction;
    }

    markupText(text){
        return text;
    }
}

class LichatUser{
    constructor(name, client){
        this._name = name;
        this._client = client;
        this.info = {};
    }

    get name(){
        return this._name;
    }

    get icon(){
        let icon = this.info[":ICON"];
        if(!icon) return EmptyIcon;
        let data = icon.split(" ");
        return "data:"+data[0]+";base64,"+data[1];
    }

    get client(){
        return this._client;
    }

    get isPresent(){
        return this.isInChannel(this._client.servername);
    }

    get isSelf(){
        return this._client.username == this._name;
    }

    get isBlocked(){
        // FIXME: implement
        return false;
    }

    get isBanned(){
        // FIXME: implement
        return false;
    }

    get isAway(){
        // FIXME: implement
        return false;
    }

    get color(){
        var hash = cl.sxhash(this._name);
        var encoded = hash % 0xFFF;
        var r = 16*(1+(encoded&0xF00)>>8)-1;
        var g = 16*(1+(encoded&0x0F0)>>4)-1;
        var b = 16*(1+(encoded&0x00F)>>0)-1;
        
        return "rgb("+Math.min(200, Math.max(50, r))
            +","+Math.min(180, Math.max(80, g))
            +","+Math.min(180, Math.max(80, b))+")";
    }

    isQuieted(channel){
        // FIXME: implement
        return false;
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
        this.messages = {};
        // KLUDGE: need this to stop Vue from being Weird As Fuck.
        Object.defineProperty(this.emotes, 'nested', { configurable: false });
        Object.defineProperty(this.messages, 'nested', { configurable: false });
        this.messageList = [];
        this.currentMessage = {text: "", replyTo: null};
        this.currentMessage.clear = ()=>{
            this.currentMessage.text = "";
            this.currentMessage.replyTo = null;
        };
        this.info[":NEWS"] = "";
        this.info[":TOPIC"] = "";
        this.info[":RULES"] = "";
        this.info[":CONTACT"] = "";
        // KLUDGE: spillage from ui
        this.unread = 0;
        this.alerted = false;
        this.lastRead = null;
        this.notificationLevel = 'inherit';
    }

    get name(){
        return this._name;
    }

    get client(){
        return this._client;
    }

    get isPresent(){
        return this.users[this._client.username.toLowerCase()] !== undefined;
    }

    get isPrimary(){
        return this._name == this._client.servername;
    }

    get isAnonymous(){
        // FIXME: this is broken
        return false;
    }

    get parentChannel(){
        // FIXME: handle channel trees
        return this._client.primaryChannel;
    }

    get icon(){
        let icon = this.info[":ICON"];
        if(!icon) return EmptyIcon;
        let data = icon.split(" ");
        return "data:"+data[0]+";base64,"+data[1];
    }

    get topic(){
        return this.info["TOPIC"];
    }

    getEmote(name){
        let own = this.emotes[name.toLowerCase().replace(/^:|:$/g,"")];
        if(own) return own;
        if(!this.isPrimary) return this.parentChannel.getEmote(name);
        return null;
    }

    getEmoteList(list){
        let emotes = list || [];
        for(let emote in this.emotes) emotes.push(emote);
        if(!this.isPrimary){
            this.parentChannel.getEmoteList(emotes);
        }
        return emotes.sort();
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

    getUser(name){
        return this._client.getUser(name.toLowerCase());
    }

    clearUsers(){
        this.users = {};
    }

    s(type, args, noPromise){
        args = args || {};
        args["channel"] = this.name;
        return this._client.s(type, args, noPromise);
    }

    record(ev){
        let message = new LichatMessage(ev, this);
        let existing = this.messages[message.gid];
        this.messages[message.gid] = message;
        if(existing){
            // Update object in-place
            for(let i in this.messageList){
                if(this.messageList[i].gid == message.gid){
                    // FIXME: Vue cannot detect this change.
                    this.messageList[i] = message;
                    break;
                }
            }
        }else if(this.messageList.length == 0 || this.messageList[this.messageList.length-1].timestamp <= message.timestamp){
            this.messageList.push(message);
        }else{
            // Perform binary search insert according to clock
            let start = 0;
            let end = this.messageList.length-1;
            let stamp = message.timestamp;
            while(start<=end){
                let mid = Math.floor((start + end)/2);
                let cmp = this.messageList[mid].timestamp;
                if(stamp <= cmp
                   && (mid == 0 || this.messageList[mid-1].timestamp <= stamp)){
                    this.messageList.splice(start, 0, message);
                    break;
                }
                if(cmp < stamp) start = mid + 1;
                else            end = mid - 1;
            }
        }
        return [message, existing?false:true];
    }

    getMessage(from, id){
        let gid = this.name+"/"+id+"@"+from.toLowerCase();
        return this.messages[gid];
    }

    deleteMessage(message){
        delete this.messages[message.gid];
        let index = this.messageList.indexOf(message);
        if(index !== -1) this.messageList.splice(index, 1);
    }

    showStatus(text, options){
        options = options || {};
        options.system = true;
        let message = new LichatMessage({
            id: nextID(),
            from: "System",
            clock: cl.getUniversalTime(),
            text: text,
            type: "MESSAGE"
        }, this, options);
        this.messageList.push(message);
        return message;
    }

    encode(){
        return {
            name: this.name,
            emotes: {...this.emotes},
            joined: this.wasJoined,
            notificationLevel: this.notificationLevel,
        };
    }

    decode(data){
        this.emotes = data.emotes;
        this.wasJoined = data.joined;
        this.notificationLevel = data.notificationLevel;
    }
};

class LichatClient{
    constructor(options){
        options = options || {};
        this.name = options.name || "Lichat";
        this.username = options.username || "";
        this.password = options.password || null;
        this.hostname = options.hostname || "localhost";
        this.port = options.port || options.ssl? LichatDefaultSSLPort: LichatDefaultPort;
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

        for(let data of options.channels || []){
            this.getChannel(data.name).decode(data);
        }

        this.addInternalHandler("CONNECT", (ev)=>{
            this.availableExtensions = ev.extensions;
        });

        this.addInternalHandler("PING", (ev)=>{
            this.s("PONG", {}, true);
        });

        this.addInternalHandler("PONG", (ev)=>{
        });

        this.addInternalHandler("JOIN", (ev)=>{
            if(!this.servername){
                this.servername = ev.channel;

                for(let name in this.channels){
                    let channel = this.channels[name];
                    if(channel.wasJoined && channel.name != this.servername)
                        channel.s("JOIN", {}, true);
                }
            }
            let channel = this.getChannel(ev.channel);
            channel.joinUser(ev.from);
            if(ev.from === this.username){
                if(this.isAvailable("shirakumo-backfill") && !channel.isPrimary)
                    this.s("BACKFILL", {channel: ev.channel}, true);
                if(this.isAvailable("shirakumo-channel-info"))
                    this.s("CHANNEL-INFO", {channel: ev.channel}, true);
                if(this.isAvailable("shirakumo-emotes"))
                    this.s("EMOTES", {channel: ev.channel, names: channel.getEmoteList()}, true);
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
            this.getChannel(ev.channel).info[LichatPrinter.toString(ev.key)] = ev.text;
        });

        this.addHandler("MESSAGE", (ev)=>{
            this.getChannel(ev.channel).record(ev);
        });

        this.addHandler("EDIT", (ev)=>{
            let message = this.getChannel(ev.channel).getMessage(ev.from, ev.id);
            if(message) message.text = ev.text;
            else cl.format("Received react with no message: ~a ~a", ev.target, ev["update-id"]);
        });

        this.addHandler("REACT", (ev)=>{
            let message = this.getChannel(ev.channel).getMessage(ev.target, ev["update-id"]);
            if(message) message.addReaction(ev);
            else cl.format("Received react with no message: ~a ~a", ev.target, ev["update-id"]);
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
                let update = this._reader.fromWire(new LichatStream(e.data));
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
                if(0 < this._reconnectAttempts)
                    this._reconnectAttempts = 0;
                
                this._socket.onmessage = ev => this.handleMessage(ev);
                this._socket.onclose = ev => this.handleClose(ev);
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
        if(this._socket && this._socket.readyState < 2){
            this._socket.onclose = ()=>{};
            this._socket.close();
        }
        this._idCallbacks = {};
        this._socket = null;
        return this;
    }

    get isConnected(){
        return this._socket && this._reconnectAttempts == 0;
    }

    send(wireable){
        if(!this._socket || this._socket.readyState != 1)
            cl.error("NOT-CONNECTED",{text: "The client is not connected."});
        let stream = new LichatStream();
        this._printer.toWire(wireable, stream);
        this._socket.send(stream.string+'\u0000');

        if(!cl.typep(wireable, "PING") && !cl.typep(wireable, "PONG"))
            cl.format("[Lichat] Send:~s", wireable);
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
        this._idCallbacks = {};
        if(event.code !== 1000){
            this.disconnectHandler(event);
            this.scheduleReconnect();
        }else{
            this.closeConnection();
        }
    }

    processCallbacks(id, update){
        let callbacks = this._idCallbacks[id];
        if(callbacks){
            for(let callback of callbacks){
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
        if(!this._idCallbacks[id]){
            this._idCallbacks[id] = [handler];
        }else{
            this._idCallbacks[id].push(handler);
        }
        return this;
    }

    removeCallback(id, handler){
        if(handler && this._idCallbacks[id])
            this._idCallbacks[id] = this._idCallbacks[id].filter(item => item !== handler);
        else
            delete this._idCallbacks[id];
        return this;
    }

    get icon(){
        if(this.servername) return this.primaryChannel.icon;
        else return EmptyIcon;
    }

    get primaryChannel(){
        if(this.servername)
            return this.getChannel(this.servername);
        else
            return null;
    }

    getChannel(name){
        let channel = this.channels[name.toLowerCase()];
        if(channel === undefined){
            channel = new LichatChannel(name, this);
            this.channels[name.toLowerCase()] = channel;
        }
        return channel;
    }

    deleteChannel(name){
        let channel = this.channels[name.toLowerCase()];
        delete this.channels[name.toLowerCase()];
        return channel;
    }

    get user(){
        if(this.username)
            return this.getUser(this.username);
        else
            return null;
    }

    getUser(name){
        let user = this.users[name.toLowerCase()];
        if(user === undefined){
            user = new LichatUser(name, this);
            this.users[name.toLowerCase()] = user;
        }
        return user;
    }

    addEmote(update){
        let name = update["name"].toLowerCase().replace(/^:|:$/g,"");
        let channel = update["channel"] || this.servername;

        if(update["payload"]){
            let emote = "data:"+update["content-type"]+";base64,"+update["payload"];
            this.getChannel(channel).emotes[name] = emote;
            return emote;
        }else{
            delete this.getChannel(channel).emotes[name];
            return null;
        }
    }

    isAvailable(name){
        return cl.find(name, this.availableExtensions);
    }
};
