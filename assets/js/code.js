function highlightCode()
{
    preserveContent();
    hljs.highlightAll();
}

function preserveContent()
{
    var pres = document.getElementsByTagName('pre');
    
    for (var pre of pres)
    {
        var code = pre.getElementsByTagName('code')[0];
        var copy = document.createElement('copy-code', { is: 'copy-code' });
        var button = document.createElement('button');
        var img = document.createElement('span');
        
        copy.setAttribute('value', code.textContent);
        button.className = 'icon';
        button.title = "Copy";
        img.className = 'copy-img';
        button.appendChild(img);
        copy.appendChild(button)
        pre.parentNode.insertBefore(copy, pre);

        button.onclick = async function() {
            var codeText = this.parentNode.getAttribute('value');
            await navigator.clipboard.writeText(codeText);
        };
    }
}

highlightCode();