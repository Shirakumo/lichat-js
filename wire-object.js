var LichatVersion = "2.0";
var IDCounter = Math.floor(Math.random()*(+new Date()));
var nextID = ()=>{
    var ID = IDCounter;
    IDCounter++;
    return ID;
};

cl.defclass("wire-object", []);
cl.defclass("update", ["wire-object"], {
    clock: cl.getUniversalTime,
    id: nextID,
    from: null
});
cl.defclass("ping", ["update"]);
cl.defclass("pong", ["update"]);
cl.defclass("connect", ["update"], {
    password: null,
    version: LichatVersion,
    extensions: []
});
cl.defclass("disconnect", ["update"]);
cl.defclass("register", ["update"], {
    password: cl.requiredArg("password")
});
cl.defclass("channel-update", ["update"], {
    channel: cl.requiredArg("channel"),
    bridge: null
});
cl.defclass("target-update", ["update"], {
    target: cl.requiredArg("target")
});
cl.defclass("text-update", ["update"], {
    text: cl.requiredArg("text")
});
cl.defclass("join", ["channel-update"]);
cl.defclass("leave", ["channel-update"]);
cl.defclass("create", ["channel-update"], {
    channel: null
});
cl.defclass("kick", ["channel-update", "target-update"]);
cl.defclass("pull", ["channel-update", "target-update"]);
cl.defclass("permissions", ["channel-update"], {
    permissions: []
});
cl.defclass("grant", ["channel-update", "target-update"], {
    update: cl.requiredArg("update")
});
cl.defclass("deny", ["channel-update", "target-update"], {
    update: cl.requiredArg("update")
});
cl.defclass("capabilities", ["channel-update"], {
    permitted: []
});
cl.defclass("message", ["channel-update", "text-update"], {
    bridge: null,
    link: null,
    "reply-to": null
});
cl.defclass("edit", ["channel-update", "text-update"]);
cl.defclass("users", ["channel-update"], {
    users: []
});
cl.defclass("channels", ["update"], {
    channels: []
});
cl.defclass("user-info", ["target-update"], {
    registered: false,
    connections: 1,
    info: []
});
cl.defclass("server-info", ["target-update"], {
    attributes: [],
    connections: []
});
cl.defclass("backfill", ["channel-update"], {
    since: null
});
cl.defclass("data", ["channel-update"], {
    "content-type": cl.requiredArg("content-type"),
    filename: null,
    payload: cl.requiredArg("payload")
});
cl.defclass("emotes", ["update"], {
    names: []
});
cl.defclass("emote", ["update"], {
    "content-type": cl.requiredArg("content-type"),
    name: cl.requiredArg("name"),
    payload: cl.requiredArg("payload")
});
cl.defclass("channel-info", ["channel-update"], {
    keys: true
});
cl.defclass("set-channel-info", ["channel-update", "text-update"], {
    key: cl.requiredArg("key")
});
cl.defclass("set-user-info", ["text-update"], {
    key: cl.requiredArg("key")
});
cl.defclass("pause", ["channel-update"], {
    by: cl.requiredArg("by")
});
cl.defclass("quiet", ["channel-update","target-update"]);
cl.defclass("unquiet", ["channel-update","target-update"]);
cl.defclass("kill", ["target-update"]);
cl.defclass("destroy", ["channel-update"]);
cl.defclass("ban", ["target-update"]);
cl.defclass("unban", ["target-update"]);
cl.defclass("blacklist", ["update"], {
    target: null
});
cl.defclass("ip-ban", ["update"], {
    ip: cl.requiredArg("ip"),
    mask: cl.requiredArg("mask")
});
cl.defclass("ip-unban", ["update"], {
    ip: cl.requiredArg("ip"),
    mask: cl.requiredArg("mask")
});
cl.defclass("ip-blacklist", ["update"], {
    target: null
});
cl.defclass("block", ["target-update"]);
cl.defclass("unblock", ["target-update"]);
cl.defclass("blocked", ["update"], {
    target: null
});
cl.defclass("react", ["channel-update"], {
    target: cl.requiredArg("target"),
    "update-id": cl.requiredArg("update-id"),
    emote: cl.requiredArg("emote")
});
cl.defclass("typing", ["channel-update"]);
cl.defclass("failure", ["text-update"]);
cl.defclass("malformed-update", ["failure"]);
cl.defclass("update-too-long", ["failure"]);
cl.defclass("connection-unstable", ["failure"]);
cl.defclass("too-many-connections", ["failure"]);
cl.defclass("update-failure", ["failure"], {
    "update-id": cl.requiredArg("update-id")
});
cl.defclass("invalid-update", ["update-failure"]);
cl.defclass("username-mismatch", ["update-failure"]);
cl.defclass("incompatible-version", ["update-failure"], {
    "compatible-versions": cl.requiredArg("compatible-versions")
});
cl.defclass("invalid-password", ["update-failure"]);
cl.defclass("no-such-profile", ["update-failure"]);
cl.defclass("username-taken", ["update-failure"]);
cl.defclass("no-such-channel", ["update-failure"]);
cl.defclass("already-in-channel", ["update-failure"]);
cl.defclass("not-in-channel", ["update-failure"]);
cl.defclass("channelname-taken", ["update-failure"]);
cl.defclass("bad-name", ["update-failure"]);
cl.defclass("insufficient-permissions", ["update-failure"]);
cl.defclass("no-such-user", ["update-failure"]);
cl.defclass("too-many-updates", ["update-failure"]);
cl.defclass("bad-content-type", ["update-failure"], {
    "allowed-content-types": []
});
cl.defclass("no-such-channel-info", ["update-failure"], {
    key: cl.requiredArg("key")
});
cl.defclass("malformed-channel-info", ["update-failure"]);
cl.defclass("no-such-user-info", ["update-failure"], {
    key: cl.requiredArg("key")
});
cl.defclass("malformed-user-info", ["update-failure"]);
cl.defclass("clock-skewed", ["update-failure"]);
