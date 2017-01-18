var IDCounter = Math.random(+new Date());
var nextID = function(){
    var ID = IDCounter;
    IDCounter++;
    return ID;
};

for(var name of ["WIRE-OBJECT","UPDATE","PING","PONG","CONNECT","DISCONNECT","REGISTER","CHANNEL-UPDATE","TARGET-UPDATE","TEXT-UPDATE","JOIN","LEAVE","CREATE","KICK","PULL","PERMISSIONS","MESSAGE","USERS","CHANNELS","USER-INFO","FAILURE","MALFORMED-UPDATE","CONNECTION-UNSTABLE","TOO-MANY-CONNECTIONS","UPDATE-FAILURE","INVALID-UPDATE","USERNAME-MISMATCH","INCOMPATIBLE-VERSION","INVALID-PASSWORD","NO-SUCH-PROFILE","USERNAME-TAKEN","NO-SUCH-CHANNEL","ALREADY-IN-CHANNEL","NOT-IN-CHANNEL","CHANNELNAME-TAKEN","BAD-NAME","INSUFFICIENT-PERMISSIONS","INVALID-PERMISSIONS","NO-SUCH-USER","TOO-MANY-UPDATES","NIL","T"]){
    cl.intern(name, "LICHAT-PROTOCOL");
}
for(var name of ["ID","CLOCK","FROM","PASSWORD","VERSION","CHANNEL","TARGET","TEXT","PERMISSIONS","USERS","CHANNELS","REGISTERED","CONNECTIONS","UPDATE-ID","COMPATIBLE-VERSIONS"]){
    cl.intern(name, "KEYWORD");
}

var WireObject = function(type){
    var self = this;

    self.type = type.toString();
    self.fields = [];

    self.set = function(key, val){
        var varname;
        if(key instanceof Symbol){
            varname = key.name.toLowerCase();
        }else{
            varname = key.toString();
        }
        self[varname] = val;
        self.fields.push(varname);
        return val;
    }

    return self;
};

var Update = function(type){
    var self = this;
    WireObject.call(self, type);

    self.set("clock", cl.getUniversalTime());
    self.set("id", nextID());
    
    return self;
};
Update.prototype = Object.create(WireObject.prototype);
