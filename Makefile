FILES=emoji.js cl.js stream.js wire-object.js printer.js reader.js client.js ui.js
OUTPUT=lichat

all: $(FILES)	
	cat $(FILES) > $(OUTPUT).js
