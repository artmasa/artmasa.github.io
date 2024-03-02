---
guid:     67c6e171-fc6c-4f8f-a400-f1aa9cccd5e8
title:    Moving this Blog to a new home!
layout:   post
tags:     github-pages markdown
comments: true
---

For some time I've been wanting to move my blog to GitHub Pages to have access to Markdown.
I've been hosting it using BlogEngine and it's been a really good experience, but I think I'm going to love the built-in Markdown support.
This is my first try!

For years I have hosted my blog in an Azure Web App. Being a .NET developer I've alwas wanted to stay in that lane and App Services have always attracted me for anything personal. I didn't create the solution my self; as I said above, I've been hosting it using BlogEngine which has a really nice editor for everything I needed.

I the last years I've spent considerable time creating web content for work using Markdown and really enjoy the simplicity of editing, publishing and have access to really low HTML level constructs when required. So, I decided to take on GitHub pages and I'm so happy I've made the decision.

Because I'm a beginner and wanted to get content migrated as soon as possible, I decided to use pre-built templates to get the site going.
THIS WAS A MISTAKE!

Not only I wasted time trying to tweak things, but I was not really understanding the tools **jekyll** provides to make things work. So I decided to start from scratch. I went first to jekyll's [website](https://jekyllrb.com) and follow all the steps in the tutorial to get my environment ready. Everything just worked!

Now that I had my environment it was really easy to put my web knowledge to work and I was able to create my site using my own designed templates, my own css and assets to make it look the way I wanted. I would recommend the same to others that want to learn the technology used to run your space.

Once I had the template in place I was able to migrate my content.
jekyll allows you to customize many things to bring the same permalink format the way you had it in other blog platforms which was one of my requirements. Without this I would not have made the move as there are other websites liking to my posts and didn't want to loose that.

Something challenging was bring the comments from the old platform to GitHub pages. I use DISQUS to manage comments to my posts and BlogEngine uses the internal page identifier to create the linkage between comments and posts. Using jekyll's powerful `front matter` templating feature I was able to provide the DISQUS engine the data it needed to bring comments over.

Let me know what you think and feel free to checkout the [source](https://github.com/artmasa/asrtmasa.github.io) and provide any feedback and suggestions.

I hope you get to enjoy the content in it's new home.