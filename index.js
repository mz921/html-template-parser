const {
    contextual,
    between,
    sequenceOf,
    sepBy,
    sepByOne,
    str,
    oneOrZero,
    eat,
    peek,
    regexParserFactory,
    setCurState,
    getCurState
} = require("parser_combinator_lib");

const leftAngleBracket = str("<");
const rightAngleBracket = str(">");
// const lineFeed = regexParserFactory(/(^\r\n)*|(^\n)*/, "lineFeed");
const identifier = regexParserFactory(/^[a-zA-Z_][a-zA-Z_0-9\-]*/, "identifier");
const attrVal = regexParserFactory(/^".*?"/, "attrVal").map(res => res.slice(1, -1));

const space = regexParserFactory(/^\s*/, "space");
const spaceOne = regexParserFactory(/^\s+/, "spaceOne");
const equalSep = sequenceOf([space, str("="), space]);
const attr = sequenceOf([identifier, equalSep, attrVal]).map(res => [res[0],res[2]]);
const attrs = sepBy(spaceOne)(attr).map(results => {
    const obj = {}
    results.forEach(v => {
        obj[v[0]] = v[1]
    })
    return obj
    
});
const unary = regexParserFactory(/^\/|/, "unary").map(res => (res ? true : false));
const unaryOne = regexParserFactory(/^\//, "unaryOne");
const closedTag = regexParserFactory(/^<(\s)*\/|/).map(res => (res ? true : false));

function* leftTagParser() {
    yield space;
    yield leftAngleBracket;
    const leftTagName = (yield identifier).result;
    yield space;
    const tagAttrs = (yield attrs).result;
    const isUnary = (yield unary).result;
    yield rightAngleBracket;
    return {
        leftTagName,
        tagAttrs,
        isUnary
    };
}

function* rightTagParser() {
    yield space;
    yield leftAngleBracket;
    yield unaryOne;
    const rightTagName = (yield identifier).result;
    yield rightAngleBracket;
    return rightTagName;
}

function* tagParser() {
    const { leftTagName, tagAttrs, isUnary } = yield* leftTagParser();
    if (isUnary) {
        return {
            tag: leftTagName,
            attrs: tagAttrs
        };
    }
    const childs = yield* htmlParser();
    const rightTagName = yield* rightTagParser();
    if (leftTagName !== rightTagName) {
        console.log("leftTag:", leftTagName);
        console.log("rightTag:", rightTagName);
        throw new Error("tag cannot close!");
    } else {
        return {
            nodeType: "Element",
            name: leftTagName,
            attrs: tagAttrs,
            childs
        };
    }
}

function* textParser() {
    yield space;
    return { nodetype: "Text", value: (yield eat("<")).result };
}

function* htmlParser() {
    const childs = [];
    while (true) {
        yield space;
        let curState = yield getCurState;
        if (curState.index === curState.targetStr.length) {
            return childs;
        }
        const isText = (yield peek).result !== "<";
        if (isText) {
            const text = yield* textParser();
            childs.push(text);
        }
        curState = yield getCurState;
        if ((yield closedTag).result) {
            yield setCurState(curState);
            if (childs.length === 0) return null;
            else if (childs.length === 1) return childs[0];
            else return childs;
        } else {
            const el = yield* tagParser();
            childs.push(el);
        }
    }
}

const parser = contextual(htmlParser).map(res => res[0]);

console.log(
    JSON.stringify(
        parser.run(`
        <html lang="en">
        <head>
            <meta charset="utf-8" foo="bar"/>
            <title>foooooo</title>
        </head>
        </html>
        `),
        null,
        "\t"
    )
);
