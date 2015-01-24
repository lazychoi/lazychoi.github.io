---
layout: default
title: category
---

<div class="potal-list">
{% for category in site.categories %}  
	<li><h2>{{ category | first }}</h2>
    <ul>
    {% for posts in category %}
      {% for post in posts %}
      	{% if post.url %}
	        <li><a href="{{ post.url }}">{{ post.title }}</a></li>
	    {% endif %}
      {% endfor %}
    {% endfor %}
    </ul>
  </li>
{% endfor %}
</div>