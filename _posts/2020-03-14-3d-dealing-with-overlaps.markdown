---
layout: post
title:  "Perspective Projection"
subtitle: "Dealing With Overlaps"
date:   2020-02-07
categories: 3d graphics z-sort painters algorithm
---

If you look closely at the code from the [previous article]({% post_url 2020-02-07-3d-perspective-projection %}) you'll notice that all the statements are carefully ordered in the code. This is because when it comes down to actually drawing lines, if line A is drawn before line B, it will get obscured by it.

When projecting to 2d, this might give the impression that line A is **behind** line B while this might not actually be the case.

![Occlusion](/assets/perspective/occlusion.png){: .center-image }

Which of the above is the truer representation?

We are interested in devising a method for ordering segments so that they get rendered far-to-near (__a.k.a__ [the painter's algorithm](https://en.wikipedia.org/wiki/Painter%27s_algorithm)).

We'll start with two segments in 3d space:

{%raw%} $$
\mathbf{AB} = \left\lbrace \vec A + t (\vec B - \vec A) | t \in \left[0..1\right] \right\rbrace \\
\mathbf{CD} = \left\lbrace \vec C + s (\vec D - \vec C) | s \in \left[0..1\right] \right\rbrace
$$ {%endraw%}


In addition, as you might imagine, occlusion depends on where you stand and where you look, so our observer will be standing at at {%raw%}$\vec V${%endraw%} looking in the direction {%raw%}$\hat D${%endraw%} at a screen at distance {%raw%}$l${%endraw%}. This observer observes that the segments intersect. To figure which of them should overlap the other, we need to follow these steps:

1. Project both segments on the plane
2. Find the intersection point
3. Cast a ray from the viewer to the intersection point, and find the ray's intersection with both segments
4. Determine which intersection point is farther from the viewer - that segment should be drawn first

## Project

We are dealing with two segments: {%raw%}$\mathbf{AB}${%endraw%} and {%raw%}$\mathbf{CD}${%endraw%}.

First we cast each vertex onto the viewer's plane (we will use lowercase vectors for vectors on the screen):

{%raw%} $$
\vec a = \vec V + \frac{l}{\hat D \cdot \left(\vec V - \vec A\right)} \left(\vec V - \vec A\right)
$$ {%endraw%}

![Project](/assets/perspective/step1-project.png){: .center-image }

## Intersect

We now have two peojected segments on the surface of the viewer's plane: {%raw%}$\mathbf{ab}${%endraw%} and {%raw%}$\mathbf{cd}${%endraw%}

### Checking for an intersection

Each segment lies on a line which can be written as:

{%raw%} $$
\vec r(t) = \vec a + t \left(\vec b - \vec a\right)
$$ {%endraw%}

If we cross ({%raw%}$\times${%endraw%}) both sides of the equation with {%raw%}$\vec b - \vec a${%endraw%} we can obtain a non-parametric equation for {%raw%}$\vec r${%endraw%} (a.k.a. locus):

{%raw%} $$
\vec r \times \left(\vec b - \vec a\right) = \vec a \times \left(\vec b - \vec a\right) \\
\Rightarrow \left(\vec r - \vec a\right) \times \left(\vec b - \vec a\right) = \vec 0
$$ {%endraw%}

This is just a way to say that {%raw%}$\vec r - \vec a${%endraw%} is aligned with {%raw%}$\vec b - \vec a${%endraw%}.

But, what if we replace {%raw%}$\vec r${%endraw%} with a vector's that's not on the line. What does the expression evaluate to?

If {%raw%}$\vec r${%endraw%} is outside the line, then according to the right hand rule the cross product {%raw%}$\left(\vec r - \vec a\right) \times \left(\vec b - \vec a\right)${%endraw%} will be perperdicular to both terms.

But we also know that {%raw%}$\vec r${%endraw%} is on the plane, and so both terms are embedded in the plane as well, which means that their cross product must be in the direction of the normal to the plane {%raw%}$\hat n${%endraw%}.

However, "in the direction" can also mean in the opposite direction. What decides whether the product is in the direction of {%raw%}$\hat n${%endraw%} or {%raw%}$-\hat n${%endraw%}?

According to the right hand rule, the rule holds only if the angle between the two vectors is smaller than {%raw%}$180^\circ${%endraw%}. If it's more that that, we need to flip the order of the vectors so that we form the smaller angle between them, and as a consequence, the direction of the product flips ({%raw%}$\mathbf{ab}${%endraw%} is black, {%raw%}$\vec{r}${%endraw%} is blue and the cross product {%raw%}$\left(\vec r - \vec a\right) \times \left(\vec b - \vec a\right)${%endraw%} is red):

![cross product direction](/assets/perspective/cross.png)

This is very important, because that {%raw%}$180^\circ${%endraw%} angle forms a border: vectors that point to one side will result in a product that's in the direction of {%raw%}$\hat n${%endraw%}, and points on the other side will result in a product in the direction of {%raw%}$-\hat n${%endraw%}, while all the points that lie on the border will result in a product that's perpendicular to {%raw%}$\hat n${%endraw%}.

We can summarize this:

{%raw%} $$
\left[\left(\vec r - \vec a\right) \times \left(\vec b - \vec a\right)\right] \cdot \hat n
\begin{cases}
    < 0 & \textrm{right of } \mathbf{ab} \\
    = 0 & \textrm{on } \mathbf{ab} \\
    > 0 & \textrm{left of } \mathbf{ab}
\end{cases}
$$ {%endraw%}

Of course _right_ and _left_ are arbitrary, but you get the idea.

There is a total of 16 configuration of both segments in relation to where each vertex lies in relation to the other segment (each vertex can be either to the left or right of the other segment, and there is a total of 4 vertices, so: {%raw%}$2^4=16${%endraw%}). Granted, many of these configuration are equivalent, but just for the sake being thorough, we'll list all of them:

|     |ab=ll|ab=lr|ab=rl|ab=rr|
|-----+-----------------------|
|cd=ll|![llll](/assets/perspective/configurations/type0/llll.png){: .center-image }|![lrll](/assets/perspective/configurations/type1/lrll.png){: .center-image }|![rlll](/assets/perspective/configurations/type1/rlll.png){: .center-image }|![rrll](/assets/perspective/configurations/type0/rrll.png){: .center-image }|
|cd=lr|![lllr](/assets/perspective/configurations/type1/lllr.png){: .center-image }||![rllr](/assets/perspective/configurations/type2/rllr.png){: .center-image }|![rrlr](/assets/perspective/configurations/type1/rrlr.png){: .center-image }|
|cd=rl|![llrl](/assets/perspective/configurations/type1/llrl.png){: .center-image }|![lrrl](/assets/perspective/configurations/type2/lrrl.png){: .center-image }||![rrrl](/assets/perspective/configurations/type1/rrrl.png){: .center-image }|
|cd=rr|![llrr](/assets/perspective/configurations/type0/llrr.png){: .center-image }|![lrrr](/assets/perspective/configurations/type1/lrrr.png){: .center-image }|![rlrr](/assets/perspective/configurations/type1/rlrr.png){: .center-image }|![rrrr](/assets/perspective/configurations/type0/rrrr.png){: .center-image }|

As you can see, due to {%raw%}$a \leftrightarrow b${%endraw%}, {%raw%}$c \leftrightarrow d${%endraw%} and {%raw%}$\mathbf{ab} \leftrightarrow \mathbf{cd}${%endraw%} symmetries, there are three configurations (grouped by color), only one of which is that of intersecting segments. The blank cells are impossible configurations (I'll leave this as a thought exercise to you).

As you can see, intersections only occurr if

1. {%raw%}$\vec{a}${%endraw%} and {%raw%}$\vec{b}${%endraw%} are on opposite sides of {%raw%}$\mathbf{cd}${%endraw%} _and_
2. {%raw%}$\vec{c}${%endraw%} and {%raw%}$\vec{d}${%endraw%} are on opposite sides of {%raw%}$\mathbf{ab}${%endraw%}

What's the mathematic interpretation of both conditions? Well, if we take the first condition, this means that either:

1. {%raw%}$\left[\left(\vec a - \vec c\right) \times \left(\vec d - \vec c\right)\right] \cdot \hat n > 0${%endraw%} and {%raw%}$\left[\left(\vec b - \vec c\right) \times \left(\vec d - \vec c\right)\right] \cdot \hat n < 0${%endraw%}
2. {%raw%}$\left[\left(\vec a - \vec c\right) \times \left(\vec d - \vec c\right)\right] \cdot \hat n < 0${%endraw%} and {%raw%}$\left[\left(\vec b - \vec c\right) \times \left(\vec d - \vec c\right)\right] \cdot \hat n > 0${%endraw%}

In other words, the signs of {%raw%}$\left[\left(\vec a - \vec c\right) \times \left(\vec d - \vec c\right)\right] \cdot \hat n${%endraw%} and {%raw%}$\left[\left(\vec b - \vec c\right) \times \left(\vec d - \vec c\right)\right] \cdot \hat n${%endraw%} are opposite. Which means their product must be negative!

Which means that the conditions for intersection are:

{%raw%} $$
\left\{\left[\left(\vec c - \vec a\right) \times \left(\vec b - \vec a\right)\right] \cdot \hat n\right\} \left\{\left[\left(\vec d - \vec a\right) \times \left(\vec b - \vec a\right)\right] \cdot \hat n\right\} < 0 \\
\textrm{and}\\
\left\{\left[\left(\vec a - \vec c\right) \times \left(\vec d - \vec c\right)\right] \cdot \hat n\right\} \left\{\left[\left(\vec b - \vec c\right) \times \left(\vec d - \vec c\right)\right] \cdot \hat n\right\} < 0
$$ {%endraw%}

### Finding the intersection

Ok, now suppose the condition passes and we know there's an intersection, how do we find it?

This is actually a geometric problem: we have a quadrilateral whose diagonals are the segments, and we want to find the ratio with which the segments divide each other.

![Quadrilateral](/assets/perspective/quadrilateral.png){: .center-image }

From the [law of sines](https://en.wikipedia.org/wiki/Law_of_sines) we obtain:

{%raw%}$$
\frac{\mathbf{am}}{\sin(\angle mca)} = \frac{\mathbf{cm}}{\sin(\angle mac)} \\
\frac{\mathbf{bm}}{\sin(\angle mcb)} = \frac{\mathbf{cm}}{\sin(\angle mbc)}
$${%endraw%}

If we divide both equations, and rearrange them, we can obtain the division ratio of the {%raw%}$\mathbf{ab}${%endraw%} diagonal:

{%raw%}$$
\frac{\mathbf{am}}{\mathbf{bm}} = \frac{\sin(\angle mca) \sin(\angle mbc)}{\sin(\angle mcb) \sin(\angle mac)}
$${%endraw%}

Where do we get the sine of these angles? Well, first we observe that {%raw%}$\angle mca = \angle dca${%endraw%}. And then we use the [geometric meaning of the cross product](https://en.wikipedia.org/wiki/Cross_product#Geometric_meaning) to obtain:

{%raw%}$$
\sin(\angle mca) = \sin(\angle dca) = \frac{\left|\vec{cd}\times\vec{ca}\right|}{\left|\vec{cd}\right| \left|\vec{ca}\right|}
$${%endraw%}

Following the same for the rest of the angles we get:

{%raw%}$$
\frac{\mathbf{am}}{\mathbf{bm}} = \frac{\left|\vec{cd}\times\vec{ca}\right| \left|\vec{ba}\times\vec{bc}\right|}{\left|\vec{cd}\times\vec{cb}\right| \left|\vec{ab}\times\vec{ac}\right|}
$${%endraw%}

And finally, the intersection point:

{%raw%}$$
\vec{m} = \frac{1}{1 + \frac{\mathbf{am}}{\mathbf{bm}}}\vec{a} + \left(1 - \frac{1}{1 + \frac{\mathbf{am}}{\mathbf{bm}}}\right)\vec{b}
$${%endraw%}

![Intersect](/assets/perspective/step2-intersect.png){: .center-image }

## Project back

We will now cast a ray from the viewer ({%raw%}$\vec V${%endraw%}) through {%raw%}$\vec m${%endraw%}:

{%raw%} $$ \vec M = \vec V + \alpha \left(\vec m - \vec V\right) $$ {%endraw%}

This should intersect with the each of the segments at points which correspond to {%raw%}$\vec m${%endraw%} on the screen.

{%raw%}$$
\vec M(\alpha) = \vec A + t \left(\vec B - \vec A\right) \\
\vec V + \alpha \left(\vec m - \vec V\right) = \vec A + t \left(\vec B - \vec A\right) \\
\alpha \left(\vec m - \vec V\right) \times \left(\vec B - \vec A\right) = \left(\vec A - \vec V\right) \times \left(\vec B - \vec A\right) \\
\alpha = \frac{\left|\left(\vec A - \vec V\right) \times \left(\vec B - \vec A\right)\right|}{\left|\left(\vec m - \vec V\right) \times \left(\vec B - \vec A\right)\right|}
$${%endraw%}

![Project back](/assets/perspective/step3-project-back.png){: .center-image }

We now just need to compare {%raw%}$\alpha${%endraw%} and {%raw%}$\beta${%endraw%} to determine which segment occludes which:

```python
V = observer._camera_position
for i in range(len(segments)):
    ab = segments[i].project_to(observer)
    for j in range(i + 1, len(segments)):
        cd = segments[j].project_to(observer)
        if not does_intersect(ab.vertices, cd.vertices, observer.screen):
            continue
        m = intersect(ab.vertices, cd.vertices)
        alpha = distance_to_segment(V, m, segments[i].vertices)
        beta = distance_to_segment(V, m, segments[j].vertices)
        if alpha < beta:
            segments[i], segments[j] = segments[j], segments[i]
```

## Complicated occlusion

Actually, we're not done yet. Support we have the following situation:

![3-way obstruction](/assets/perspective/segments3way.png){: .center-image }

There we have:
* Green occluding blue and occluded by purple
* Blue occluding purple and occluded by green
* Purple occluding green and occluded by blue

There isn't really a way to order the three segments because for each of them it's both in front and behind the other two.

To overcome this we are going to have to break them into segments that have only one intersection with any other segment.

The strategy is pretty simple:

* Cast all the segments to the screen.
* For each segment, find all possible intersections with all the other segments.
* Trace back the point to a point on the 3d segment

![3-way intersections](/assets/perspective/segments3way-intersect.png){: .center-image }

* Break the segment into smaller pieces between intersections (requires sorting the intersections points)

![3-way fragmented](/assets/perspective/segments3way-fragment.png){: .center-image }

```python
V = observer._camera_position
fragments = []
for segment in self._segments:
    intersections = []
    for other in self._segments:
        if segment == other:
            continue
        ab = segment.project_to(observer)
        cd = other.project_to(observer)
        if not does_intersect(ab.vertices, cd.vertices, observer.screen):
            continue
        m = intersect(ab.vertices, cd.vertices)
        M = intersect_ray_with_segment(V, m, segment.vertices)
        intersections.append(M)
    if len(intersections) > 1:
        start = segment.vertices[0]
        intersections.sort(key=lambda i: (i - start) & (i - start))
        midpoints = [(a + b) / 2 for a, b in pairwise(intersections)]
        fragments.extend(segment.fragment(midpoints))
    else:
        fragments.append(segment)

segments = sort_segment(fragments)
```

Here's an example that combines all the elements in this article:

<video controls autoplay="autoplay" loop="loop" class="center-image">
  <source src="/assets/perspective/spin.webm" type="video/webm">
</video>

I went ahead and pushed the new code to the [3dpp repository](https://github.com/danzat/3dpp) together with some other improvements and documentation. Be sure to check it out!
