// Define some defaults that apply globally.
var LichatVersion = "2.0";
var LichatDefaultPort = 1113;
var LichatDefaultSSLPort = 1114;
var LichatDefaultClient = {
    name: "TyNET",
    username: "",
    password: "",
    aliases: [],
    hostname: "chat.tymoon.eu",
    port: LichatDefaultSSLPort,
    ssl: true
};
var EmptyIcon = URL.createObjectURL(cl.base64toBlob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "image/png"));

// Representation of a connection to a Lichat server.
class LichatClient{
    constructor(options){
        options = options || {};
        // The name of the client. Only used for local representation.
        this.name = options.name || "Lichat";

        // The name the user uses to connect and send messages with.
        this.username = options.username || "";
        this.password = options.password || null;
        this.hostname = options.hostname || "localhost";
        this.port = options.port || (options.ssl? LichatDefaultSSLPort: LichatDefaultPort);

        // Whether we're connecting via SSL or not.
        this.ssl = options.ssl || (options.port == LichatDefaultSSLPort);

        // Function to be called when a disconnect happens.
        this.disconnectHandler = ()=>{};

        // The actual name of the server. This is not the same as the hostname.
        this.servername = null;

        // How long to wait until a ping message is sent.
        this.pingDelay = 15000;

        // Map of channel names to LichatChannel instances.
        this.channels = {};

        // Map of user names to LichatUser instances.
        this.users = {};

        // List of extensions supported by this client.
        this.supportedExtensions = ["shirakumo-data", "shirakumo-backfill", "shirakumo-emotes",
                                    "shirakumo-channel-info", "shirakumo-quiet", "shirakumo-pause",
                                    "shirakumo-server-management", "shirakumo-ip", "shirakumo-user-info",
                                    "shirakumo-icon", "shirakumo-bridge", "shirakumo-block",
                                    "shirakumo-reactions", "shirakumo-link", "shirakumo-typing",
                                    "shirakmuo-history"];
        this.supportedExtensions = this.supportedExtensions.filter((extension)=>
            !(options.disabledExtensions || []).includes(extension));

        // List of extensions actually available (determined after connection).
        this.availableExtensions = ["shirakumo-icon"];

        // WebSocket object used for communication
        this._socket = null;

        // Map of update types to handler functions. These are for users.
        this._handlers = {};

        // Map of update types to handler functions. These are for our internal use.
        this._internalHandlers = {};

        // Map of update IDs to callback handler functions.
        this._idCallbacks = {};

        //  Reader/Writer objects for the wire protocol.
        this._reader = new LichatReader();
        this._printer = new LichatPrinter();

        // ID of the JS timer used to handle ping timeouts.
        this._pingTimer = null;

        // Tracker for how many reconnections there's been.
        this._reconnectAttempts = 0;

        // Counter for the next ID to use when sending updates.
        this._IDCounter = Math.floor(Math.random()*(+new Date()));

        // Reconstruct channels from options passed.
        for(let data of options.channels || []){
            let channel = new LichatChannel(data, this);
            this.channels[channel.name.toLowerCase()] = channel;
        }

        // Reconstruct users from options passed.
        for(let data of options.users || []){
            let user = new LichatUser(data, this);
            this.users[user.name.toLowerCase()] = user;
        }

        // Define internal message handlers to perform necessary plumbing.
        this.addInternalHandler("connect", (ev)=>{
            this.availableExtensions = ev.extensions.filter((extension)=>this.supportedExtensions.includes(extension));
        });

        this.addInternalHandler("ping", (ev)=>{
            this.s("pong", {}, true);
        });

        this.addInternalHandler("pong", (ev)=>{
        });

        this.addInternalHandler("join", (ev)=>{
            // If we don't know the server name yet this is the first join message
            // and thus must be the primary channel according to protocol.
            if(!this.servername)
                this.servername = ev.channel;
            let channel = this.getChannel(ev.channel);
            channel.joinUser(ev.from);
            // If we've joined, there's a few plumbing requests we want to make.
            if(ev.from === this.username){
                if(channel.isPrimary){
                    // If we've now joined the primary channel, send join requests for all
                    // channels we were previously or are currently joined to.
                    // We delay this by a bit to allow other stuff to populate.
                    setTimeout(()=>{
                        if(!this.isConnected) return;
                        for(let name in this.channels){
                            let channel = this.channels[name];
                            if(channel.wasJoined && !channel.isPresent)
                                channel.s("join", {}, true);
                        }
                    }, 500);
                }
                // Refresh info, as it might have changed in our absence.
                channel.s("users", {}, true);
                if(this.isAvailable("shirakumo-channel-info"))
                    channel.s("channel-info", {keys: true}, true);
                if(this.isAvailable("shirakumo-emotes"))
                    channel.s("emotes", {names: channel.getEmoteList()}, true);
            }
        });

        this.addInternalHandler("leave", (ev)=>{
            let channel = this.getChannel(ev.channel);
            channel.leaveUser(ev.from);
        });

        this.addInternalHandler("emote", (ev)=>{
            this.addEmote(ev);
        });

        // Convenience function to handle the special case of the icon update,
        // which we need to translate to an icon object.
        let handleIconInfo = (info, ev)=>{
            if(ev.key !== cl.kw('icon')) return null;

            let key = LichatPrinter.toString(ev.key);
            if(info[key]) URL.revokeObjectURL(info[key].url);
            
            let data = ev.text.split(" ");
            let blob = cl.base64toBlob(data[1], data[0]);
            info[key] = {
                blob: blob,
                url: URL.createObjectURL(blob)
            };
            return info[key];
        };

        this.addInternalHandler("set-channel-info", (ev)=>{
            if(!handleIconInfo(this.getChannel(ev.channel).info, ev))
                this.getChannel(ev.channel).info[LichatPrinter.toString(ev.key)] = ev.text;
        });

        this.addInternalHandler("set-user-info", (ev)=>{
            let target = ev.target || this.username;
            if(!handleIconInfo(this.getUser(target).info, ev))
                this.getUser(target).info[LichatPrinter.toString(ev.key)] = ev.text;
        });

        this.addInternalHandler("user-info", (ev)=>{
            let user = this.getUser(ev.target || this.username);
            for(let entry of ev.info){
                user.info[LichatPrinter.toString(entry[0])] = entry[1];
            }
        });

        this.addInternalHandler("message", (ev)=>{
            this.getChannel(ev.channel).record(ev);
        });

        this.addInternalHandler("edit", (ev)=>{
            let message = this.getChannel(ev.channel).getMessage(ev.from, ev.id);
            if(message) message.text = ev.text;
            else console.warn("Received react with no message", ev.target, ev["update-id"]);
        });

        this.addInternalHandler("react", (ev)=>{
            let message = this.getChannel(ev.channel).getMessage(ev.target, ev["update-id"]);
            if(message) message.addReaction(ev);
            else console.warn("Received react with no message", ev.target, ev["update-id"]);
        });

        this.addInternalHandler("capabilities", (ev)=>{
            this.getChannel(ev.channel).capabilities = ev.permitted;
        });

        this.addInternalHandler("users", (ev)=>{
            for(let name of ev.users){
                this.getChannel(ev.channel).users[name.toLowerCase()] = this.getUser(name);
            }
        });

        this.addInternalHandler("typing", (ev)=>{
            this.getChannel(ev.channel).setTyping(this.getUser(ev.from), ev.clock);
        });

        this.addInternalHandler("quiet", (ev)=>{
            this.getChannel(ev.channel)._quieted.add(this.getUser(ev.target));
        });
        
        this.addInternalHandler("unquiet", (ev)=>{
            this.getChannel(ev.channel)._quieted.delete(this.getUser(ev.target));
        });
        
        this.addInternalHandler("quieted", (ev)=>{
            let set = new WeakSet();
            for(let username in ev.target)
                set.add(this.getUser(username));
            this.getChannel(ev.channel)._quieted = set;
        });
    }

    // Used to perform a manual reconnect.
    reconnect(){
        try{
            this.clearReconnect();
            this.openConnection()
                .catch(()=>this.scheduleReconnect());
        }catch(e){
            this.scheduleReconnect();
        }
    }

    // Schedules another reconnect after an increasing delay.
    scheduleReconnect(){
        this._reconnectAttempts++;
        let secs = Math.min(600, Math.pow(2, this._reconnectAttempts));
        this._reconnecter = setTimeout(()=>this.reconnect(), secs*1000);
    }

    // Cancel reconnection attempts
    clearReconnect(){
        if(this._reconnecter){
            clearTimeout(this._reconnecter);
            this._reconnecter = null;
            this._reconnectAttempts = 0;
        }
    }

    // Handle the WebSocket and Lichat protocol handshake.
    // Returns a promise that will be fulfilled once the Lichat handshake
    // has been completed and the connection is fully usable. The argument
    // for the promise will be the client itself.
    openConnection(){
        return new Promise((ok, fail) => {
            this._socket = new WebSocket((this.ssl?"wss://":"ws://")+this.hostname+":"+this.port, "lichat");
            this._socket.onopen = ()=>{
                this.s("connect", {
                    password: this.password || null,
                    version: LichatVersion,
                    extensions: this.supportedExtensions
                }, true);
            };
            this._socket.onmessage = (e)=>{
                let update = this._reader.fromWire(new LichatStream(e.data));
                try{
                    if(!(cl.typep(update, "object")))
                        fail({text: "non-Update message", update: update});
                    else if(update.type.name !== "connect")
                        fail({text: update.text, update: update});
                    else{
                    }
                }catch(err){
                    this.closeConnection();
                }
                this.clearReconnect();
                
                if(!this.username)
                    this.username = update.from;

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

    // Closes the connection and clears out any internal state
    // related to it, such as lists of present users in channels.
    closeConnection(){
        this.clearReconnect();
        for(let channel in this.channels)
            this.channels[channel].clearUsers();
        if(this._pingTimer){
            clearTimeout(this._pingTimer);
            this._pingTimer = null;
        }
        if(this._socket && this._socket.readyState < 2){
            this._socket.onclose = ()=>{};
            this._socket.close();
        }
        this._idCallbacks = {};
        this._socket = null;
        return this;
    }

    // Returns true if the client is currently connected.
    // This returns true even if the client has not completed the
    // WebSocket or Lichat handshakes and is just trying to establish
    // a connection at this time.
    get isConnected(){
        return this._socket && this._reconnectAttempts == 0;
    }

    // Returns true if the client is currently trying to establish
    // a connection.
    get isConnecting(){
        return this._socket && 0 < this._reconnectAttempts;
    }

    // Returns the next ID to be used in an update.
    nextID(){
        let ID = this._IDCounter;
        this._IDCounter++;
        return ID;
    }

    // Sends a wireable object to the server.
    send(wireable){
        if(!this._socket || this._socket.readyState != 1)
            throw new Error("The client is not connected.");
        if(!cl.typep(wireable, "ping") && !cl.typep(wireable, "pong"))
            console.debug("Send", wireable);
        let stream = new LichatStream();
        this._printer.toWire(wireable, stream);
        this._socket.send(stream.string+'\u0000');
        return wireable;
    }

    // Sends an update of the given type and fields to the server.
    // Returns a promise that is fulfilled if the server replies to the update
    // positively, and failed if the server replies with a failure. The promise
    // arguments are the response updates.
    // If noPromise is true, returns the sent update instance instead.
    s(type, args, noPromise){
        args = args || {};
        if(!args.from) args.from = this.username;
        if(!args.clock) args.clock = cl.getUniversalTime();
        if(!args.id) args.id = this.nextID();
        let update = cl.makeInstance(type, args);
        if(noPromise) return this.send(update);
        return new Promise((ok, fail)=>{
            try{
                this.send(update);
            }catch(e){
                fail(e);
            }
            this.addCallback(update.id, (u) => {
                if(cl.typep(u, "failure")) fail(u);
                else                       ok(u);
            }, fail);
        });
    }

    // Used to start the process of sending a pingback in case of lack of updates
    startDelayPing(){
        if(this._pingTimer) clearTimeout(this._pingTimer);
        this._pingTimer = setTimeout(()=>{
            if(this._socket.readyState == 1){
                this.s("ping", {}, true);
                this.startDelayPing();
            }
        }, this.pingDelay);
        return this._pingTimer;
    }

    // Parses and distributes the WebSocket event.
    handleMessage(event){
        try{
            let update = this._reader.fromWire(new LichatStream(event.data));
            this.startDelayPing();
            this.process(update);
        }catch(e){
            console.error("Error during message handling", e);
        }
        return this;
    }

    // Processes a WebSocket close event.
    handleClose(event){
        this._idCallbacks = {};
        if(event.code !== 1000){
            this.disconnectHandler(event);
            this.scheduleReconnect();
        }else{
            this.closeConnection();
        }
    }

    // Processes all callback functions that registered for
    // the given ID. After they have run, the callbacks are
    // deregistered.
    processCallbacks(id, update){
        let callbacks = this._idCallbacks[id];
        if(callbacks){
            for(let callback of callbacks){
                try{
                    callback.call(this, update);
                }catch(e){
                    console.error("Callback error", e);
                }
            }
            this.removeCallback(id);
        }
    }

    // Processes the given update by passing it to callbacks and handlers.
    // This respects the update's class hierarchy and calls all applicable handlers.
    process(update){
        if(!cl.typep(update, "ping") && !cl.typep(update, "pong"))
            console.debug("Update",update);
        if(cl.typep(update, "update-failure"))
            this.processCallbacks(update["update-id"], update);
        else
            this.processCallbacks(update.id, update);
        if(!this.maybeCallInternalHandler(update.type.name, update)){
            for(let s of cl.classOf(update).superclasses){
                if(this.maybeCallInternalHandler(s.className, update))
                    break;
            }
        }
        if(!this.maybeCallHandler(update.type.name, update)){
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

    // Returns the icon URL that should be used to represent the client.
    get icon(){
        if(this.servername) return this.primaryChannel.icon;
        else return EmptyIcon;
    }

    // Returns the LichatChannel object that represents the server's primary channel.
    get primaryChannel(){
        if(this.servername)
            return this.getChannel(this.servername);
        else
            return null;
    }

    // Returns the LichatChannel object of the given name.
    // If the name is unknown, a new channel object is made and registered.
    getChannel(name){
        let channel = this.channels[name.toLowerCase()];
        if(channel === undefined){
            channel = new LichatChannel(name, this);
            this.channels[name.toLowerCase()] = channel;
        }
        return channel;
    }

    // Removes the given channel from the client permanently.
    // This does not leave the channel. Use with care.
    deleteChannel(channel){
        if(typeof(channel) === "string") channel = this.getChannel(channel);
        delete this.channels[name.toLowerCase()];
        return channel;
    }

    // Returns true if the given channel is known on this client.
    hasChannel(channel){
        if(typeof(channel) !== "string") channel = channel.name;
        return channel.toLowerCase() in this.channels;
    }

    // Returns the client's connecting LichatUser instance.
    get user(){
        if(this.username)
            return this.getUser(this.username);
        else
            return null;
    }

    // Returns the LichatUser object of the given name.
    // If the name is unknown, a new user object is made and registered.
    getUser(name){
        let user = this.users[name.toLowerCase()];
        if(user === undefined){
            user = new LichatUser(name, this);
            this.users[name.toLowerCase()] = user;
        }
        return user;
    }

    addEmote(update){
        let channel = update.channel || this.servername;
        return this.getChannel(channel).addEmote(update);
    }

    // Returns true if the protocol extension of the given name is supported.
    isAvailable(name){
        return cl.find(name, this.availableExtensions);
    }

    // Returns true if you can send an update of the given type to the primary channel.
    isPermitted(update){
        if(!this.primaryChannel) return false;
        return this.primaryChannel.isPermitted(update);
    }
}

// Function to parse a search query string into a structure
// that is accepted as per the shirakumo-search extension.
LichatClient.parseQuery = (query)=>{
    let parseWord = (i)=>{
        let start = i;
        for(; i<query.length; ++i){
            let char = query[i];
            if(char == ':' || char == ' ' || char == '"')
                break;
        }
        if(start === i) return null;
        return [i, query.slice(start, i)];
    };

    let parseString = (i)=>{
        if(query[i] == '"'){
            ++i;
            for(let start=i; i<query.length; ++i){
                if(query[i] == '"' && query[i-1] != '!')
                    return [i+1, query.slice(start, i)];
            }
        }
        return null;
    };

    let parseToken = (i)=>{
        return parseString(i) || parseWord(i);
    };

    let parseField = (i)=>{
        let word = parseWord(i);
        if(word && query[word[0]] == ':'){
            i = word[0];
            let token = null;
            for(; !token; ++i) token = parseToken(i);
            return [token[0], word[1], token[1]];
        }
        return null;
    };

    let parseDate = (i)=>{
        // FIXME: do
        return cl.T;
    };
    
    let i = 0;
    let parts = {
        after: [],
        before: [],
            in: [],
        from: [],
        text: []
    };
    for(; i<query.length;){
        let field = parseField(i);
        if(field){
            i = field[0];
            parts[field[1].toLowerCase()].push(field[2]);
            continue;
        }
        let token = parseToken(i);
        if(token){
            i = token[0];
            parts['text'].push(token[1]);
            continue;
        }
        ++i;
    }

    query = [];
    if(parts.after.length || parts.before.length){
        query.push(cl.kw('clock'));
        query.push([parseDate(parts.after), parseDate(parts.before)]);
    }
    if(parts.from.length){
        query.push(cl.kw('from'));
        query.push(parts.from);
    }
    if(parts.text.length){
        query.push(cl.kw('text'));
        query.push(parts.text);
    }
    return [query, (parts.in.length)? parts.in[0] : null];
};
