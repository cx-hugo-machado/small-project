import OpenAI from "openai";


const model = "gpt-4"; // This is an inline comment
const client = new OpenAI();

function summarize(text) {
    const model = "gpt-4";
    return client.responses.create({model, input: text});
}

function classify(text) {
    return client.responses.create({model: "gpt-4", input: text});
}
