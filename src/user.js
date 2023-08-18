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
