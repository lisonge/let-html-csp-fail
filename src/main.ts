import CDP from 'chrome-remote-interface';
import HTMLParser from 'node-html-parser';

const client = await CDP();
const { Network, Page } = client;

await Network.setRequestInterception({
    patterns: [
        {
            urlPattern: '*',
            resourceType: 'Document',
            interceptionStage: 'HeadersReceived',
        },
    ],
});

client['Network.requestIntercepted'](
    async ({ interceptionId, responseHeaders = {}, request }) => {
        responseHeaders = { ...responseHeaders };

        const response = await Network.getResponseBodyForInterception({
            interceptionId,
        });
        const bodyText = response.base64Encoded
            ? Buffer.from(response.body, 'base64').toString('utf-8')
            : response.body;
        const html = HTMLParser.parse(bodyText);
        html.querySelectorAll(`meta`).forEach((meta) => {
            if (
                meta.getAttribute('http-equiv')?.toLowerCase() ==
                'content-security-policy'
            ) {
                meta.remove();
            }
        });
        const newBodyText = html.toString();
        responseHeaders['Content-Length'] = newBodyText.length.toString();
        const newHeaders = Object.entries(responseHeaders).map(
            ([k, v]) => `${k}:\x20${v}`
        );

        Network.continueInterceptedRequest({
            interceptionId,
            rawResponse: Buffer.from(
                'HTTP/1.1 200 OK' +
                    '\r\n' +
                    newHeaders.join('\r\n') +
                    '\r\n\r\n' +
                    newBodyText
            ).toString('base64'),
        });
        console.log(request.url);
    }
);

await Network.enable({});
await Page.enable();
await Page.navigate({ url: 'https://i.songe.li/csp' });
await client['Page.loadEventFired']();
