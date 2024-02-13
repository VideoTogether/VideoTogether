export class SecureFrame {
    constructor() {
        const iframe = document.createElement('iframe');
        iframe.sandbox = 'allow-scripts allow-same-origin';
        iframe.srcdoc = `<html><body>12341234234</body></html>`;
        iframe.style = 'position: absolute; right: 15px; bottom: 15px; width: 262px; height: 212px; background: transparent; border: none; z-index: 2147483647; position:fixed;';

        document.body.appendChild(iframe);

    }
}