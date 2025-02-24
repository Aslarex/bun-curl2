import BunCurl from "../src";


const testCurl = new BunCurl({
    transfomRequest(args) {
        if (args.headers) {
            if (args.headers instanceof Headers) {
                args.headers.set("x-required-header", "some_random_value");
            } else {
                args.headers["x-required-header"] = "some_random_value";
            }
        } else {
            args.headers = {
                "x-required-header": "some_random_value"
            }
        }
        return args;
    },
});


// get request
const example_get = await testCurl.get("https://httpbin.org/anything");


// post request with body
const example_post = await testCurl.post("https://httpbin.org/anything", {
    body: {
        json_key: "json_value"
    }
});

console.log("GET RESPONSE", example_get.response);

console.log("POST RESPONSE", example_post.response);

process.exit();