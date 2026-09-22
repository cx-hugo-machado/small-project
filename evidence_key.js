import OpenAI from "openai";




const model = "gpt-4"; // This is an inline comment - updated
// comment added here
// another comment
const client = new OpenAI();

function summarize(text) {
    const model = "gpt-4";
    // Comment added
    return client.responses.create({model, input: text});
}

function classify(text) {
    return client.responses.create({model: "gpt-4", input: text});
}
