---
---
var discus_config;

function loadDisqus(id, pageUrl, legacyId) {
    
    var siteUrl = 'https://blog.darkloop.com';
    var shortname = legacyId == '' ? '{{ site.disqusId }}' : '{{ site.disqusOldId}}';

    disqus_config = function () {
        if (legacyId == '') {
            this.page.identifier = id;
            this.page.url = siteUrl + pageUrl;
        } else {
            this.page.url = siteUrl + legacyId;
        }
    };

    (function() {
        var d = document, s = d.createElement('script');
        s.src = `https://${shortname}.disqus.com/embed.js`;
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