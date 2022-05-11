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

// Class encapsulating a reaction, which is either an emoji or a Lichat emote
// combined with a list of users that used this reaction. Used to keep track
// of reactions to messages.
class LichatReaction{
    constructor(update, channel){
        this.text = update.emote;
        // This regex detects valid unicode emoji strings.
        let emojiRegex = /^(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|[\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|[\ud83c[\ude32-\ude3a]|[\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])+$/;
        if(!emojiRegex.test(update.emote)){
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

// Class encapsulating a Lichat message within a channel.
class LichatMessage{
    constructor(update, channel, options){
        options = options || {};
        // Local id from the update itself
        this.id = update.id;

        // Name of the user that sent the message
        this.from = update.from;

        // The actual user object from which the message came
        this.author = channel.client.getUser(update.bridge || update.from);

        // The channel object in which the message was sent
        this.channel = channel;

        // List of LichatReaction objects tied to the message.
        this.reactions = [];

        // Plaintext representation of the massage without markup.
        this.text = update.text || "";

        // Rich text representation of the message. This will have parsed URLs and emote images and so on.
        this.html = (options.html)? this.text: this.markupText(this.text);

        // Whether the message is a system message. If true, the message was faked locally.
        this.isSystem = options.system;

        // A "globally unique ID" that should identify the message across all channels and clients.
        this.gid = options.gid || LichatMessage.makeGid(channel, update.from, update.id);

        // A link to the message within the client.
        this.url = document.location.href.match(/(^[^#]*)/)[0]+"#"+this.gid;

        // The Unix timestamp of when the message was sent.
        this.timestamp = cl.universalToUnix(update.clock);

        // A JS Date object of when the message was sent.
        this.clock = new Date(this.timestamp*1000);

        // The originating update type as a simple string.
        this.type = update.type.name;

        // What content this message contains as a mime-type.
        // For embeds, this can be something like image/png.
        this.contentType = update.link || "text/plain";

        // The message type this message is in reply to, if any.
        if(update["reply-to"])
            this.replyTo = channel.getMessage(update["reply-to"][0], update["reply-to"][1]);
        else
            this.replyTo = null;
    }

    get client(){
        return this.channel.client;
    }

    get time(){
        let pad = (x)=>(x<10?"0":"")+x;
        return pad(this.clock.getHours())+":"+pad(this.clock.getMinutes());
    }

    get date(){
        return this.clock.toLocaleDateString()+
            ", "+this.clock.toLocaleTimeString();
    }

    get isImage(){ return this.contentType.includes("image"); }

    get isVideo(){ return this.contentType.includes("video"); }

    get isAudio(){ return this.contentType.includes("audio"); }

    // Whether this message should be considered an alert for the user.
    get isAlert(){
        let pattern = this.client.username.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        return new RegExp(pattern, "gi").test(this.text);
    }

    // Whether the message actually came from a real update or not.
    get isVirtual(){
        return this.id === undefined;
    }

    // Whether the message came from a user using the shirakumo-bridged extension to send
    // a message on behalf of another user or not. In that case, should display the message
    // specially to indicate the spoof-iness to the user.
    get isBridged(){
        return this.author.name == this.from;
    }

    // Shortened version of the message for use in blurbs, notification popups, etc.
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

    // Process a new reaction update on the message and update the internal reactions
    // bookkeeping logic. Returns the recation objcet that represents the update.
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

// Constructs a string identifying the message in a globally unique way.
LichatMessage.makeGid = (channel, author, id)=>{
    return channel.client.servername+"  "+channel.name+"  "+author.toLowerCase()+"  "+id;
};

// Representation of a user on a lichat connection.
// Note that the same user will still have separate LichatUser instances across multiple
// clients/connections.
class LichatUser{
    constructor(data, client){
        if(typeof data === 'string')
            data = {name: data};

        // The user's chosen name (case preserved)
        this._name = data.name;
        this._client = client;

        // Local nickname of the user, in case the client would like to display a different
        // name than what is used in actual updates.
        this.nickname = data.nickname || data.name;

        // Info fields supported through the shirakumo-user-info extension. Keys are
        // printed representations of symbols.
        this.info = data.info || {
            ":birthday": "",
            ":contact": "",
            ":location": "",
            ":public-key": "",
            ":real-name": "",
            ":status": "",
            ":icon": ""
        };
    }

    // Returns a globally unique identifier for the given user.
    get gid(){
        return this._client.servername+"  "+this._name;
    }

    get name(){
        return this._name;
    }

    // Returns an URL that can be used for the user's icon.
    get icon(){
        let icon = this.info[":icon"];
        if(!icon) return EmptyIcon;
        else      return icon.url;
    }

    get client(){
        return this._client;
    }

    // Returns a CSS colour string to be used for the user.
    get color(){
        var hash = cl.sxhash(this._name);
        var encoded = hash % 0xFFF;
        var r = 16*(1+(encoded&0xF00)>>8)-1;
        var g = 16*(1+(encoded&0x0F0)>>4)-1;
        var b = 16*(1+(encoded&0x00F)>>0)-1;
        
        return "rgb("+Math.min(200, Math.max(50, r))+
            ","+Math.min(180, Math.max(80, g))+
            ","+Math.min(180, Math.max(80, b))+")";
    }

    // Returns true if the user is known to be connected at the moment.
    get isPresent(){
        return this.isInChannel(this._client.servername);
    }

    // Returns true if the user is from the current client's own connection.
    get isSelf(){
        return this._client.username.localeCompare(this._name, undefined, { sensitivity: 'accent' }) === 0;
    }

    // Returns true if the user is the server administrative account.
    get isServer(){
        return this._client.servername.localeCompare(this._name, undefined, { sensitivity: 'accent' }) === 0;;
    }

    // Returns true if the user has been blocked and thus their messages should not be shown.
    get isBlocked(){
        // FIXME: implement
        return false;
    }

    // Returns true if the user has been banned and thus they should not be able to connect.
    get isBanned(){
        // FIXME: implement
        return false;
    }

    // Returns true if the user has been shadow-banned in the given channel.
    isQuieted(channel){
        if(typeof(channel) === "string") channel = this._client.getChannel(channel);
        return channel.isQuieted(this);
    }

    // Returns true if the ser is currently present in the given channel.
    isInChannel(channel){
        if(typeof(channel) === "string") channel = this._client.getChannel(channel);
        return channel.hasUser(this);
    }

    // Convenience function to send an update with the target set to this user.
    s(type, args, noPromise){
        args = args || {};
        args.target = this.name;
        return this._client.s(type, args, noPromise);
    }
}

// Representation of a channel on a particular client/connection.
class LichatChannel{
    constructor(data, client){
        if(typeof data === 'string')
            data = {name: data};
        
        this._name = data.name;
        this._client = client;

        // Whether the client used to be joined to this channel
        // Used to determine whether to re-join the channel on reconnect.
        this.wasJoined = data.wasJoined || false;

        // Map of *present* LichatUser objects representing them.
        // Index is a downcased version of their name.
        this.users = {};

        // Map of emotes specific to this channel.
        // An emote is an object with fields blob and url. The former being
        // the basic binary blob of the emote data, and the url being a
        // usable URL of the image for use in img tags.
        // The keys are the actual emote names without colons.
        this.emotes = data.emotes || {};

        // Info fields supported through the shirakumo-channel-info extension.
        // Keys are printed representations of symbols.
        this.info = data.info || {
            ":news": "",
            ":topic": "",
            ":rules": "",
            ":contact": "",
            ":icon": ""
        };

        // Map of known messages in the channel. Values are LichatMessages,
        // keys are their GIDs.
        this.messages = {};

        // Chronological list of all the messages from oldest to newest.
        this.messageList = [];

        // Whether there are any users currently typing in this channel.
        this.hasTypers = false;

        // JS timer ID to keep track of typing indicator
        this._typingTimeout = null;

        // Map of currently typing users for tracking.
        this._typingUsers = new Map();

        // List of updates that are known to be permitted to be sent in
        // the channel. If NULL, set is unknown.
        this._capabilities = null;

        // Set of users known to be quieted in the channel.
        this._quieted = new WeakSet();

        // KLUDGE: need this to stop Vue from being Weird As Fuck.
        Object.defineProperty(this.emotes, 'nested', { configurable: false });
        Object.defineProperty(this.messages, 'nested', { configurable: false });

        // KLUDGE: spillage from ui
        // Used to keep track of the current message that the user is composing
        // and in particular the replyTo message reference.
        this.currentMessage = {text: "", replyTo: null};
        this.currentMessage.clear = ()=>{
            this.currentMessage.text = "";
            this.currentMessage.replyTo = null;
        };

        // Used to keep track of actually visible messages, which should be a window
        // of all messages in order to keep the browser from exploding.
        this.uiMessageList = [];

        // Counter for number of unread messages in the channel.
        this.unread = 0;

        // Whether there have been any messages that were alerts that haven't been seen.
        this.alerted = false;

        // Reference to the message that was last marked as having been read.
        // This can be synced through the shirakumo-last-read extension.
        this.lastRead = data.lastRead || null;

        // The level of notifications on this channel. Should be one of:
        // - none     --- Do not notify at all
        // - all      --- Notify on any message whatsoever
        // - mentions --- Notify only on messages mentioning the current user
        // - inherit  --- Inherit notification level from client's global setting
        this.notificationLevel = data.notificationLevel || this.isPrimary? 'none' : 'inherit';

        let lastSlash = this._name.lastIndexOf('/');
        // Keeps track of the parent channel's name, should this be a child channel.
        if(lastSlash === -1)
            this._parentChannelName = null;
        else
            this._parentChannelName = this._name.slice(0, lastSlash);
    }

    // Globally unique string identifying this channel.
    get gid(){
        return this._client.servername+"  "+this._name;
    }

    get name(){
        return this._name;
    }

    get client(){
        return this._client;
    }

    // Returns true if the user is currently in this channel.
    get isPresent(){
        return this.users[this._client.username.toLowerCase()] !== undefined;
    }

    // Returns true if the channel is the administrative channel for the server.
    get isPrimary(){
        return this._name == this._client.servername;
    }

    // Returns true if the channel is anonymous and thus transitive.
    get isAnonymous(){
        return this._name[0] === '@';
    }

    // Returns the parent LichatChannel object that this channel should
    // inherit from.
    get parentChannel(){
        let name = this._parentChannelName;
        if(name === null)
            return this._client.primaryChannel;
        else
            return this._client.getChannel(name);
    }

    // Returns the icon URL for the channel for use in img tags.
    get icon(){
        let icon = this.info[":icon"];
        if(!icon) return EmptyIcon;
        else      return icon.url;
    }

    // Returns the channel's topic string.
    get topic(){
        return this.info[":topic"];
    }

    // Returns the set of update types that the user can send on this channel.
    // If unknown, will fetch the capabilities list and tentatively return the empty list.
    // You should use LichatChannel.isPermitted instead of manually checking this list.
    get capabilities(){
        if(this._capabilities == null){
            this._capabilities = [];
            this.s("capabilities", {})
                .catch((e)=>{
                    this._capabilities = null;
                    if(cl.typep(e, "too-many-updates"))
                        setTimeout(this.capabilities, 1000);
                });
        }
        return this._capabilities;
    }

    set capabilities(value){
        this._capabilities = value.sort();
    }

    // Returns the list of LichatUsers currently known to be typing in this channel.
    get typingUsers(){
        let currentClock = cl.getUniversalTime();
        let users = [];
        for(const [user, clock] of this._typingUsers){
            if(currentClock - clock < 5)
                users.push(user);
            else
                delete this._typingUsers.delete(user);
        }
        this.hasTypers = 0 < users.length;
        return users;
    }

    // Returns the emote object of the given name, if known.
    getEmote(name){
        let own = this.emotes[name.toLowerCase().replace(/^:|:$/g,"")];
        if(own) return own.url;
        if(!this.isPrimary) return this.parentChannel.getEmote(name);
        return null;
    }

    // Returns the list of all emotes available in this channel, including
    // emotes inherited from parent channels.
    getEmoteList(list){
        let emotes = list || [];
        for(let emote in this.emotes) emotes.push(emote);
        if(!this.isPrimary){
            this.parentChannel.getEmoteList(emotes);
        }
        return emotes.sort();
    }

    // Adds the given user to the list of present users in the channel.
    joinUser(user){
        if(typeof(user) === "string") user = this._client.getUser(user);
        if(user.name === this._client.username) this.wasJoined = true;
        this.users[user.name.toLowerCase()] = user;
        return user;
    }

    // Removes the given user from the list of present users in the channel.
    leaveUser(user){
        if(typeof(user) === "string") user = this._client.getUser(user);
        if(user.isSelf){
            this.wasJoined = false;
            this.users = {};
        }else{
            delete this.users[user.name.toLowerCase()];
        }
        return user;
    }

    // Returns true if the given user is present in the channel.
    hasUser(user){
        if(user instanceof LichatUser) user = user.name;
        return this.users[user.toLowerCase()] !== undefined;
    }

    // Returns the user object of the given name.
    getUser(name){
        return this._client.getUser(name);
    }

    // Returns a list of usernames of users currently present.
    getUserList(){
        return Object.keys(this.users);
    }

    clearUsers(){
        this.users = {};
    }

    // Returns true if the given user is shadow-banned in the channel.
    isQuieted(user){
        return this._quieted.has(user);
    }

    // Set the user as having been typing at the given time.
    setTyping(user, clock){
        if(user.isSelf) return;
        this.hasTypers = true;
        this._typingUsers.set(user, clock);
        
        if(this._typingTimeout !== null)
            clearTimeout(this._typingTimeout);
        this._typingTimeout = setTimeout(()=>{
            this._typingTimeout = null;
            console.log(this.typingUsers);
        }, 5000);
    }

    // Convenience to send an update with the channel field set.
    s(type, args, noPromise){
        args = args || {};
        args.channel = this.name;
        return this._client.s(type, args, noPromise);
    }

    // Record the message in the channel's history.
    // Returns a list of:
    // - The LichatMessage object representing the message
    // - Whether the message was already in the history or not
    record(message){
        if(!(message instanceof LichatMessage))
            message = new LichatMessage(message, this);
        let existing = this.messages[message.gid];
        this.messages[message.gid] = message;
        if(existing){
            Object.assign(existing, message);
        }else{
            LichatChannel._insertMessageSorted(message, this.messageList);
        }
        return [message, existing?false:true];
    }

    // Returns the LichatMessage object identified by the from/id pair, if any.
    getMessage(from, id){
        let gid = LichatMessage.makeGid(this, from, id);
        return this.messages[gid];
    }

    // Removes the given message from the channel's history.
    deleteMessage(message){
        delete this.messages[message.gid];
        let index = this.messageList.indexOf(message);
        if(index !== -1) this.messageList.splice(index, 1);
    }

    // Convenience function to show a local status text in the channel.
    showStatus(text, options){
        options = options || {};
        options.system = true;
        let message = new LichatMessage({
            id: this._client.nextID(),
            from: "System",
            clock: cl.getUniversalTime(),
            text: text,
            type: "message"
        }, this, options);
        this.messageList.push(message);
        return message;
    }

    // Convenience function to show an error message in the channel.
    showError(error, prefix){
        console.error(error);
        let message = prefix || 'Error';
        if(cl.typep(error, 'failure'))
            message += ": "+error.text;
        else if(error instanceof Error)
            message += ": "+error.message;
        else if(error instanceof DOMException)
            message += ": "+error.message;
        else if(typeof error === 'string')
            message += ": "+error;
        return this.showStatus(message);
    }

    // Returns true if it is known that the user is permitted to send
    // updates of the given type to this channel. If this returns
    // false, should probably not send the message, as it will most
    // likely fail with a permission denied.
    isPermitted(update){
        if(typeof update === 'string' || update instanceof String)
            update = cl.intern(update, "lichat");
        let caps = this.capabilities;
        if(caps == []) return true; // Default to true. The server will deny later anyway.
        return this.capabilities.includes(update);
    }

    // Records the given emote update in the channel's list of known
    // emotes. This also handles emote deletions or updates correctly.
    addEmote(update){
        let name = update.name.toLowerCase().replace(/^:|:$/g,"");
        if(update.payload){
            let emote = this.emotes[name];
            if(emote) URL.revokeObjectURL(emote.url);
            else emote = {};
            emote.blob = cl.base64toBlob(update.payload, update["content-type"]);
            emote.url = URL.createObjectURL(emote.blob);
            this.emotes[name] = emote;
            return emote;
        }else{
            delete this.emotes[name];
            return null;
        }
    }
}

// Convenience function to insert a message in the correct position in the given list,
// taking into account timestamp ordering and out of order insertions.
LichatChannel._insertMessageSorted = (message, list)=>{
    if(list.length == 0 || list[list.length-1].timestamp <= message.timestamp){
        list.push(message);
    }else{
        // Perform binary search insert according to clock
        let start = 0;
        let end = list.length-1;
        let stamp = message.timestamp;
        while(start<=end){
            let mid = Math.floor((start + end)/2);
            let cmp = list[mid].timestamp;
            if(stamp <= cmp &&
               (mid == 0 || list[mid-1].timestamp <= stamp)){
                list.splice(start, 0, message);
                break;
            }
            if(cmp < stamp) start = mid + 1;
            else            end = mid - 1;
        }
    }
};

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
