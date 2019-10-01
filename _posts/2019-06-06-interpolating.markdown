---
layout: post
title:  "Shield...Thyroid"
date:   2019-06-06 22:13:36 +0300
categories: programming math
published: false
---

Recently, my g/f had to give a presentation on hypothyroidism, and in the presentation she wanted to give a quick introduction on the thyroid, starting with its name, which is derived from the Greek for shield (θυρεοειδής) due to it's resemblance to a shield. She wanted to demonstrate it by showing an animation of a thyroid gland transforming into a shield.

Searching the web yielded no results, so I decided I'll brush off the dust from Inkscape and give it a go. I found two images, traced them into a path, and tried the _Interpolate_ feature. But, for some odd reason, the interpolation gave horribly mangled results.

So it got me thinking, I can probably do better. This is basically interpolating one path to another.

# Plan outline

Let's start with a simple(ish) case - a square morphing to a circle.

![Circle \& Square](/assets/interpolate/circle-and-square.png){: .center-image }

If we interpose them one over the other, and trace a line from their mutual center outwards, it will cross both shapes at a certain point.

![Circle on Square](/assets/interpolate/circle-on-square.png){: .center-image }

Follow the same process for additional pairs of points, and we get an _average_ between the two shapes.

Since the guides can be characterized by a single angle parameter $\theta\$ we can write equations for both shapes.

Circle (the simpler of the two):

$$C(\theta) = (\cos(\theta), \sin(\theta))$$

Square:

$$S(\theta) = \begin{cases}
(1, \tan(\theta)) & 0 < \theta < \frac{\pi}{4} \or \frac{7\pi}{4} < \theta < 2\pi \\
(\cot(\theta), 1) & \frac{\pi}{4} < \theta < \frac{3\pi}{4} \\
(-1, -\tan(\theta)) & \frac{3\pi}{4} < \theta < \frac{5\pi}{4} \\
(-\cot(\theta), -1) & \frac{5\pi}{4} < \theta < \frac{7\pi}{4} \\
\end{cases}$$

We can now sample the linear interpolation between the two shapes:
$$P(t) = \left(1-t\right)S(t) + t C(t)$$

![Circle + Square](/assets/interpolate/sampled-square.png){: .center-image }

_There's a small issue with selecting the correct amount of sampling points to preserve the "pointy" nature of the square's vertices._

# Sampling

What we did was all fine, for a square and circle that is. Sampling points on the perimeter of a circle is trivial, and on a square a bit more involved, yet still simple enough. What about more complex shapes? For example: a shield.
 
Specifically, we are using the SVG format for vector images. In these, shapes are defined by a "path".

This path is a series of 3 types of elements: lines, quadratic Bézier curves and cubic Bézier curves.

## Lines
pretty straightforward: there's a start and end point. This is a simple linear interpolation:

$$P(t) = (1-t) S + t E$$

## Quadratic Bézier curve

Specified by three points: A start point $S$, an control point $C$, and an end point $E$. The points along the curve follow the following (2nd order) interpolation:

$$P(t) = (1-t)^2 S + 2 t (1-t) C + t^2 E$$

## Cubic Bézier curve

Specified by four points: start ($S$) and end ($E$) point, and *two* control points ($C_1$ and $C_2$).

Cubic curves exist because they allow setting independent start and end directions (or derivatives) for the curve, which allows splicing curves smoothly. The points on the curve follow a 3rd order interpolation:

$$P(t) = (1-t)^3 S + 3 t (1-t) ^ 2 C_1 + 3 t^2 (1-t) C_2 + t^3 E$$

We can make up a class to represent each of these primitive curves:

```python
class CubicBezier:
    def __init__(self, start, control1, control2, end):
        self.s = start
        self.c1 = control1
        self.c2 = control2
        self.e = end

    def __call__(self, t):
        s, c1, c2, e = self.s, self.c1, self.c2, self.e
        r = 1 - t
        return r**3 * s + 3 * r**2 * t * c1 + 3 * r * t**2 * c2 + t**3 * e
```

A path $\mathcal{P}$ is a set of $N$ primitive curves $\left\lbrace P_1, ..., P_N \right\rbrace$.

```python
class Path:
    def __init__(self, curves):
        self._curves = curves
    def __len__(self):
        return sum(map(len, self._curves))
```

We want to find $M$ equally spaced points along the path. So, if the path's length is $\left\|\mathcal{P}\right\| = \sum_{i=1}^{N} \left\| P_i \right\|$, we need the points to be spaced $\frac{\mathcal{P}}{M}$ apart.

But what's the length of a cubic curve? Well, the exact equation would be:

$$\left|P\right| = \int_{t=0}^1 dl = \int_0^1 \left|P(t+dt) - P(t)\right|dt  = \int_0^1 \left|\frac{dP}{dt}\right| dt$$

It turns out that for cubic curves, it's impossible to find a closed expression for this integral (Abel-Ruffini theorem).

We could however do an approximation:

$$\left|P\right| \approx \sum_{i=0}^N \Delta l_i = \sum_{i=0}^N \left|P(i\Delta t + \Delta t) - P(i\Delta t)\right| \approx \sum_{i=0}^N \left|\frac{dP(i\Delta t)}{dt}\right| \Delta t$$

Where $\Delta t = \frac{1}{N}$.

This is easy to implement:

```python
class CubicBezier:
    # ...
    def derivative(self, t):
        s, c1, c2, e = self.s, self.c1, self.c2, self.e
        r = 1 - t
        q = 1 - 3 * t
        p = 2 - 3 * t
        return -3 * r**2 * s + 3 * r * q * c1 + 3 * t * p * c2 + 3 * t**2 * e

    def __len__(self):
        N = 100
        Dt = 1.0 / N
        return sum(len(self.derivative(i * Dt)) for i in range(N + 1))
```

# Adding curves

If for each sample point we also compute the tangent vector, we can use that to reconstruct a cubic curve from every pair of points:

$$\frac{dP(0)}{dt} = -3 P(0) + 3 C_1 \rightarrow C_1 = \frac{1}{3} \frac{dP(0)}{dt} + P(0) \\
\frac{dP(1)}{dt} = -3 C_2 + 3 P(1) \rightarrow C_2 = P(1) - \frac{1}{3} \frac{dP(1)}{dt}$$
