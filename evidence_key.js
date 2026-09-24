import OpenAI from "openai";
const model = "gpt-4"; // This is an inline comment - updated 3
// comment
const client = new OpenAI(); // comment


// comment added here
// another comment

// comment added here
function summarize(text, param2) {
    // comment inside
    console.log(param2);
    const model = "gpt-4";
    // Comment added
    return client.responses.create({model, input: text});
}

function classify(text) {
    return client.responses.create({model: "gpt-4", input: text});
}

setTimeout(function () {
    const model = "gpt-4";   // line 7
    console.log(model);
}, 1000);

setInterval(function (param1) {
    let aaa = "bbb";
    // this is another comment

    console.log(param1);
    
    const model = "gpt-4";   // line 12
    console.log(model);
}, 5000);
