---
---
var discus_config;

function loadDisqus(pageIdentifier, pageUrl) {
    
    var siteUrl = 'https://blog.darkloop.com';

    disqus_config = function () {
        this.page.url = siteUrl + pageIdentifier;
        //this.page.identifier = siteUrl + pageIdentifier;
    };

    (function() {
        var d = document, s = d.createElement('script');
        s.src = 'https://{{site.disqusId}}.disqus.com/embed.js';
        s.setAttribute('data-timestamp', +new Date());
        (d.head || d.body).appendChild(s);
    })();
}

document.addEventListener('theme-toggled', function(e) {
    if (document.readyState == 'complete') {
        setTimeout(function() {
            DISQUS.reset({ reload: true, config: disqus_config });
        }, 1000);
    }
});