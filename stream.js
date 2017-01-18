var LichatStream = function(string){
    var self = this;
    self.string = string || "";
    var i = 0;

    self.readChar = function(errorp){
        if(errorp === undefined)errorp = true;
        if(i < self.string.length){
            var character = self.string[i];
            i++;
            return character;
        }else if(errorp){
            throw "End of stream reached.";
        }else{
            return null;
        }
    };

    self.unreadChar = function(){
        if(0 < i){
            i--;
        }else{
            throw "Cannot unread more.";
        }
    };

    self.peekChar = function(errorp){
        if(errorp === undefined)errorp = true;
        if(i < self.string.length){
            return self.string[i];
        }else if(errorp){
            throw "End of stream reached.";
        }else{
            return null;
        }
    };

    self.writeChar = function(character){
        self.string += character;
        i++;
        return character;
    };

    self.writeString = function(string){
        self.string += string;
        i += string.length;
        return string;
    };

    self.toString = function(){
        return self.string;
    }
    
    return self;
}
