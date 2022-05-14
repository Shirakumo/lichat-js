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
