var LichatDefaultPort = 1113;

var LichatClient = function(options){
    var self = this;

    options = options || {};
    if(!options.username) options.username = "Lion";
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
    self.channels = [];
    self.ssl = false;

    if(window.localStorage){
        self.emotes = JSON.parse(window.localStorage.getItem("emotes")) || {};
    }

    var supportedExtensions = ["shirakumo-data", "shirakumo-backfill", "shirakumo-emotes"];
    var availableExtensions = [];
    var internalHandlers = {};
    var idCallbacks = {};
    var reader = new LichatReader();
    var printer = new LichatPrinter();
    var status = null;
    var pingTimer = null;

    self.openConnection = ()=>{
        status = "STARTING";
        var socket = new WebSocket((self.ssl?"wss://":"ws://")+self.hostname+":"+self.port, "lichat");
        socket.onopen = ()=>{
            self.s("CONNECT", {password: self.password || null,
                               version: LichatVersion,
                               extensions: supportedExtensions,
                               socket: socket});
        };
        socket.onmessage = (e)=>{self.handleMessage(socket, e);};
        socket.onclose = (e)=>{
            if(e.code !== 1000 && status != "STOPPING"){
                self.handleFailure(new Condition("SOCKET-CLOSE", {
                    text: "Error "+e.code+" "+e.reason,
                    socket: socket,
                    event: e
                }));
            }
            self.closeConnection(socket);
        };
        self.socket = socket;
        return socket;
    };

    self.closeConnection = (socket)=>{
        socket = socket || self.socket;
        self.channels = [];
        if(status != "STOPPING"){
            status = "STOPPING";
            if(socket && socket.readyState < 2){
                socket.close();
            }
            if(self.socket == socket){ 
                self.socket = null;
            }
        }
        return socket;
    };

    self.send = (socket, wireable)=>{
        if(!socket || socket.readyState != 1)
            cl.error("NOT-CONNECTED",{text: "The client is not connected."});
        cl.format("[Lichat] Send:~s", wireable);
        var stream = new LichatStream();
        printer.toWire(wireable, stream);
        socket.send(stream.string+'\u0000');
        return wireable;
    };

    self.s = (type, args)=>{
        args = args || {};
        var socket = args.socket || self.socket;
        if(!args.from) args.from = self.username;
        delete args.socket;
        var update = cl.makeInstance(type, args);
        return self.send(socket, update);
    };

    self.startDelayPing = (socket)=>{
        if(pingTimer) clearTimeout(pingTimer);
        pingTimer = setTimeout(()=>{
            if(socket.readyState == 1){
                self.s("PING", {socket: socket});
                self.startDelayPing(socket);
            }
        }, self.pingDelay);
        return pingTimer;
    };

    self.handleMessage = (socket, event)=>{
        try{
            var update = reader.fromWire(new LichatStream(event.data));
            self.startDelayPing(socket);
            update.socket = socket;
            switch(status){
            case "STARTING":
                try{
                    if(!(cl.typep(update, "WIRE-OBJECT")))
                        cl.error("CONNECTION-FAILED",{text: "non-Update message", update: update});
                    if(update.type !== "CONNECT")
                        cl.error("CONNECTION-FAILED",{text: update.text, update: update});
                }catch(e){
                    self.handleFailure(e);
                    self.closeConnection(socket);
                    throw e;
                }
                status = "RUNNING";
                self.servername = update.from;
                self.process(update);
                break;
            case "RUNNING":
                self.process(update);
                break;
            }
        }catch(e){
            cl.format("Error during message handling: ~s", e);
        }
        return self;
    };

    self.process = (update)=>{
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
            self.removeCallback(update.id);
        }
        if(!self.maybeCallInternalHandler(update.type, update)){
            for(var s of cl.classOf(update).superclasses){
                if(self.maybeCallInternalHandler(s.className, update))
                    break;
            }
        }
        if(!self.maybeCallHandler(update.type, update)){
            for(var s of cl.classOf(update).superclasses){
                if(self.maybeCallHandler(s.className, update))
                    break;
            }
        }
        return self;
    };

    self.maybeCallInternalHandler = (type, update)=>{
        if(internalHandlers[type]){
            internalHandlers[type](update);
            return true;
        }
        return false;
    };

    self.addInternalHandler = (update, handler)=>{
        internalHandlers[update] = handler;
        return self;
    };

    self.removeInternalHandler = (update)=>{
        delete internalHandlers[update];
        return self;
    };

    self.maybeCallHandler = (type, update)=>{
        if(self.handlers[type]){
            self.handlers[type](update);
            return true;
        }
        return false;
    };

    self.addHandler = (update, handler)=>{
        self.handlers[update] = handler;
        return self;
    };

    self.removeHandler = (update)=>{
        delete self.handlers[update];
        return self;
    };

    self.addCallback = (id, handler)=>{
        if(!idCallbacks[id]){
            idCallbacks[id] = [handler];
        }else{
            idCallbacks[id].push(handler);
        }
        return self;
    };

    self.removeCallback = (id)=>{
        delete idCallbacks[id];
        return self;
    };

    self.addEmote = (emote)=>{
        var name = ":"+emote["name"].toLowerCase().replace(/^:|:$/g,"")+":";
        self.emotes[name] = "<img class=\"emote\" alt=\""+name+"\" title=\""+name+"\" src=\"data:"+emote["content-type"]+";base64,"+emote["payload"]+"\" />";
        if(window.localStorage){
            window.localStorage.setItem("emotes", JSON.stringify(self.emotes));
        }
        return emote;
    };

    self.addInternalHandler("CONNECT", (ev)=>{
        availableExtensions = ev.extensions;
        if(cl.find("shirakumo-emotes", availableExtensions)){
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
        if(ev.from === self.username && ev.channel !== self.servername){
            cl.pushnew(ev.channel, self.channels);
            if(cl.find("shirakumo-backfill", availableExtensions)){
                self.s("BACKFILL", {channel: ev.channel});
            }
        }
    });

    self.addInternalHandler("LEAVE", (ev)=>{
        if(ev.from === self.username){
            self.channels = cl.remove(ev.channel, self.channels);
        }
    });

    self.addInternalHandler("EMOTE", (ev)=>{
        self.addEmote(ev);
    });
};
