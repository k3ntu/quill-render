var fs = require('fs'),
	cheerio = require('cheerio');



var format = {

	block: {
		image: function($, src) {
			var img = $('<img>');
			img.attr('src', src);
			this.append(img);
		},
		pdf: function($, src) {
			var embed = $('<iframe>');
			embed.attr('src', 'https://docs.google.com/gview?embedded=true&url=' + encodeURIComponent(src));
			this.append(embed);
		}
	},

	inline: {
		italic: function($) {
			return $('<i>');
		},
		bold: function($) {
			return $('<b>');
		},
		link: function($, href) {
			return $('<a>').attr('href', href);
		}
	},

	lineify: {
		h1: function() {
			this[0].name = 'h1';
		},
		h2: function() {
			this[0].name = 'h2';
		},
		h3: function() {
			this[0].name = 'h3';
		},
		blockquote: function() {
			this[0].name = 'blockquote';
		},
		bullet: {
			group: function($) {
				return $('<ul>');
			},
			line: function() {
				this[0].name = 'li';
			}
		},
		list: {
			group: function($) {
				return $('<ol>');
			},
			line: function() {
				this[0].name = 'li';
			}
		}
	}

};

function convert(ops) {
	var $ = cheerio.load(''), group, line, el, activeInline;

	function newLine() {
		el = line = $('<p>');
		$.root().append(line);
		activeInline = {};
	}
	newLine();

	for (var i = 0; i < ops.length; i++) {
		var op = ops[i];
		if (op.insert === 1) {
			for (var k in op.attributes) {
				newLine();
				format.block[k].call(line, $, op.attributes[k]);
				newLine();
				activeInline = {};
			}
		} else {
			var lines = op.insert.split('\n');

			if (isLinifyable(op.attributes)) {
				// Some line-level styling (ie headings) is applied by inserting a \n
				// with the style; the style applies back to the previous \n.
				// There *should* only be one style in an insert operation.

				for (var j = 1; j < lines.length; j++) {
					for (var k in op.attributes) {
						if (format.lineify[k]) {

							var fn = format.lineify[k];
							if (typeof fn == 'object') {
								if (group && group.type != k) {
									group = null;
								}
								if (!group && fn.group) {
									group = {
										el: fn.group($),
										type: k,
										distance: 0
									};
									$.root().append(group.el);
								}

								if (group) {
									group.el.append(line);
									group.distance = 0;
								}
								fn = fn.line;
							}

							fn.call(line, $, op.attributes[k]);
							newLine();
							break;
						}
					}
				}

			} else {

				for (var j = 0; j < lines.length; j++) {
					if (group && ++group.distance >= 2) {
						group = null;
					}
					applyStyles(op.attributes, ops[i+1] && ops[i+1].attributes);
					console.log(lines[j]);
					el.append(lines[j]);
					if (j < lines.length-1) {
						newLine();
					}
				}

			}
		}
	}

	return $.html();

	function applyStyles(attrs, next) {

		var first = [], then = [];
		attrs = attrs || {};

		for (var k in attrs) {
			if (format.inline[k]) {

				if (activeInline[k]) {
					if (activeInline[k] != attrs[k]) {
						// ie when two links abut
						console.log('abut');

					} else {
						console.log('nada');
						continue; // do nothing -- we should already be inside this style's tag
					}
				}
				
				if (next && attrs[k] == next[k]) {
					first.push(k); // if the next operation has the same style, this should be the outermost tag
				} else {
					then.push(k);
				}
				activeInline[k] = attrs[k];
			
			}
		}

		for (var k in activeInline) {
			if (!attrs[k]) {
				console.log(el[0].name, '->', el.parent()[0].name);
				el = el.parent();
				delete activeInline[k];
			}
		}

		console.log(first, then);

		first.forEach(apply);
		then.forEach(apply);

		function apply(fmt) {
			console.log('apply', fmt);
			var newEl = format.inline[fmt].call(null, $, attrs[fmt]);
			el.append(newEl);
			el = newEl;
		}


	}
}

function isLinifyable(attrs) {
	for (var k in attrs) {
		if (format.lineify[k]) {
			return true;
		}
	}
	return false;
}






var html = convert(require('./doc.json').ops);

fs.writeFileSync('out.html', html);

console.log('ok');

