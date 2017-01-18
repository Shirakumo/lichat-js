var LichatVersion = "1.0";
var LichatDefaultPort = 1113;

var LichatClient = function(options){
    var self = this;

    options = options || {};
    if(!options.username) options.username = "Lion";
    if(!options.password) options.password = null;
    if(!options.hostname) options.hostname = "ws://localhost";
    if(!options.port) options.port = LichatDefaultPort;

    for(var key in options){
        self[key] = options[key];
    }
    
    self.socket = null;
    self.handlers = {};
    
    var reader = new LichatReader();
    var printer = new LichatPrinter();
    var status = "STARTING";

    self.openConnection = function(){
        self.socket = new WebSocket(self.hostname, "lichat");
        self.socket.onopen = ()=>{
            self.s("CONNECT", {password: self.password,
                               version: LichatVersion});
        };
        self.socket.onmessage = self.handleConnection;
        self.socket.onclose = self.closeConnection;
    };

    self.closeConnection = function(){
        if(!self.socket) throw "The client is not connected.";
        if(status != "STOPPING"){
            status = "STOPPING";
            if(self.socket.readyState < 2){
                self.socket.close();
            }
            self.socket = null;
        }
    };

    self.send = function(wireable){
        if(!self.socket) throw "The client is not connected.";
        var stream = new LichatStream();
        printer.toWire(wireable, stream);
        self.socket.send(stream.string);
    };

    self.s = function(type, args){
        var update = new Update(type);
        for(var key in args){
            update[key] = args[key];
        }
        if(!update.from) update.from = self.username;
        self.send(update);
    };

    self.handleConnection = function(event){
        try{
            var update = reader.fromWire(new LichatStream(event.data));
            switch(status){
            case "STARTING":
                if(!(update instanceof Update))
                    throw "Error during connection: non-Update message: "+update;
                if(update.type !== "CONNECT")
                    throw "Error during connection: non-CONNECT update: "+update;
                status = "RUNNING";
                self.process(update);
                break;
            case "RUNNING":
                self.process(update);
                break;
            }
        }catch(e){
            console.log(e);
        }
    };

    self.process = function(update){
        var handler = self.handlers[update.type];
        if(handler){
            handler(self, update);
        }else{
            console.log(update);
        }
    };

    self.addHandler = function(update, handler){
        self.handlers[update] = handler;
    }

    self.removeHandler = function(update){
        self.handlers[update] = null;
    }
};
