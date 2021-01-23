var LichatStream = function(string){
    var self = this;
    self.string = string || "";
    var i = 0;

    self.readChar = (errorp)=>{
        if(errorp === undefined)errorp = true;
        if(i < self.string.length){
            var character = self.string[i];
            i++;
            return character;
        }else if(errorp){
            cl.error("END-OF-STREAM");
        }
        return null;
    };

    self.unreadChar = ()=>{
        if(0 < i){
            i--;
        }else{
            cl.error("BEGINNING-OF-STREAM");
        }
    };

    self.peekChar = (errorp)=>{
        if(errorp === undefined)errorp = true;
        if(i < self.string.length){
            return self.string[i];
        }else if(errorp){
            cl.error("END-OF-STREAM");
        }
        return null;
    };

    self.writeChar = (character)=>{
        self.string += character;
        return character;
    };

    self.writeString = (string)=>{
        self.string += string;
        return string;
    };

    self.toString = ()=>{
        return self.string;
    };
    
    return self;
};
