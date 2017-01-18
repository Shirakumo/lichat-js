var WireObject = function(type){
    var self = this;

    self.type = type.toString();

    self.set = function(key, val){
        if(key instanceof Symbol){
            self[key.name.toLowerCase()] = val;
        }else{
            self[key.toString()] = val;
        }
        return val;
    }

    self.get = function(key){
        if(key instanceof Symbol){
            return self[key.name.toLowerCase()];
        }else{
            return self[key.toString()];
        }
    }

    return self;
};
