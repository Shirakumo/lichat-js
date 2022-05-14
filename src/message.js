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
