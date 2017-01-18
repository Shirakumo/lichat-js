FILES=cl.js stream.js wire-object.js printer.js reader.js
OUTPUT=lichat.js

all: $(FILES)
	cat $(FILES) > $(OUTPUT)
