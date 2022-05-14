FILES=src/cl.js src/stream.js src/wire-object.js src/printer.js src/reader.js src/reaction.js src/user.js src/channel.js src/message.js src/client.js src/ui.js
OUTPUT=lichat

all: $(FILES)	
	cat $(FILES) > $(OUTPUT).js

regen: spec/lichat.sexpr spec/shirakumo.sexpr regen.js
	node regen.js
