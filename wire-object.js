var LichatVersion = "1.0";
var IDCounter = Math.floor(Math.random()*(+new Date()));
var nextID = ()=>{
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

cl.defclass("WIRE-OBJECT", []);
cl.defclass("UPDATE", ["WIRE-OBJECT"], {
    clock: cl.getUniversalTime,
    id: nextID,
    from: cl.requiredArg("from")
});
cl.defclass("PING", ["UPDATE"]);
cl.defclass("PONG", ["UPDATE"]);
cl.defclass("CONNECT", ["UPDATE"], {
    password: null,
    version: LichatVersion
});
cl.defclass("DISCONNECT", ["UPDATE"]);
cl.defclass("REGISTER", ["UPDATE"], {
    password: cl.requiredArg("register")
});
cl.defclass("CHANNEL-UPDATE", ["UPDATE"], {
    channel: cl.requiredArg("channel")
});
cl.defclass("TARGET-UPDATE", ["UPDATE"], {
    target: cl.requiredArg("target")
});
cl.defclass("TEXT-UPDATE", ["UPDATE"], {
    text: cl.requiredArg("text")
});
cl.defclass("JOIN", ["CHANNEL-UPDATE"]);
cl.defclass("LEAVE", ["CHANNEL-UPDATE"]);
cl.defclass("CREATE", ["CHANNEL-UPDATE"], {
    channel: null
});
cl.defclass("KICK", ["CHANNEL-UPDATE", "TARGET-UPDATE"]);
cl.defclass("PULL", ["CHANNEL-UPDATE", "TARGET-UPDATE"]);
cl.defclass("PERMISSIONS", ["CHANNEL-UPDATE"], {
    permissions: []
});
cl.defclass("MESSAGE", ["CHANNEL-UPDATE"]);
cl.defclass("USERS", ["CHANNEL-UPDATE"], {
    users: []
});
cl.defclass("CHANNELS", ["UPDATE"], {
    users: []
});
cl.defclass("USER-INFO", ["TARGET-UPDATE"], {
    registered: false,
    connections: 1
});
cl.defclass("FAILURE", ["TEXT-UPDATE"]);
cl.defclass("MALFORMED-UPDATE", ["FAILURE"]);
cl.defclass("CONNECTION-UNSTABLE", ["FAILURE"]);
cl.defclass("TOO-MANY-CONNECTIONS", ["FAILURE"]);
cl.defclass("UPDATE-FAILURE", ["FAILURE"], {
    "update-id": cl.requiredArg("update-id")
});
cl.defclass("INVALID-UPDATE", ["UPDATE-FAILURE"]);
cl.defclass("USERNAME-MISMATCH", ["UPDATE-FAILURE"]);
cl.defclass("INCOMPATIBLE-VERSION", ["UPDATE-FAILURE"], {
    "compatible-versions": cl.requiredArg("compatible-versions")
});
cl.defclass("INVALID-PASSWORD", ["UPDATE-FAILURE"]);
cl.defclass("NO-SUCH-PROFILE", ["UPDATE-FAILURE"]);
cl.defclass("USERNAME-TAKEN", ["UPDATE-FAILURE"]);
cl.defclass("NO-SUCH-CHANNEL", ["UPDATE-FAILURE"]);
cl.defclass("ALREADY-IN-CHANNEL", ["UPDATE-FAILURE"]);
cl.defclass("NOT-IN-CHANNEL", ["UPDATE-FAILURE"]);
cl.defclass("CHANNELNAME-TAKEN", ["UPDATE-FAILURE"]);
cl.defclass("BAD-NAME", ["UPDATE-FAILURE"]);
cl.defclass("INSUFFICIENT-PERMISSIONS", ["UPDATE-FAILURE"]);
cl.defclass("NO-SUCH-USER", ["UPDATE-FAILURE"]);
cl.defclass("TOO-MANY-UPDATES", ["UPDATE-FAILURE"]);
