const htmlparser2 = require("htmlparser2");
const iconv = require('iconv-lite');
const fs = require('fs');

module.exports = {
    parse: function(callback){
        const prodList = [],
            priceList = [];
        let isFirst = false;

        const isPriceTag = (tagname, attribs) => {
            return tagname === "row" && attribs.value !== "" && attribs.pricetype === "3";
        };
        const isProdTag = (tagname, attribs) => {
            return tagname === "row" && attribs.name && attribs.code && attribs.instruct;
        };

        fs.readFile('./1213.xml', null, (err, data) => {
            if (err) { return callback(err) }
            const file = iconv.decode(data, "cp1251").toString();

            const parser = new htmlparser2.Parser({
                onopentag(tagname, attribs) {
                    if (isPriceTag(tagname, attribs)) {
                        priceList.push({
                            value: attribs.value
                        });
                    }
                    if (isProdTag(tagname, attribs)) {
                        prodList.push({
                            code: attribs.code,
                            name: attribs.name,
                            instruct: attribs.instruct,
                            period: attribs.comment
                        });
                    }
                }
            }, {
                decodeEntities: true
            });

            parser.write(file);

            parser.end();

            const resaultList = prodList.map((obj, idx) => {
                return {
                    ...priceList[idx],
                    ...obj
                };
            });

            callback(null, resaultList);
        });
    }
}