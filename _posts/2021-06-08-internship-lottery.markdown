---
layout: post
title:  "Internship Lottery"
subtitle: "Overview and Setup"
date:   2021-06-08
categories: algorithm
---

Recently my wife, who's studying medicine, had to partake in what's called an "internship lottery". The basic idea is that there are 25 hospitals, each with a specific amount of vacancies, and students need to be assigned to internships.

Granted, some hospitals are more popular than others, so some students are bound to get disappointed. To keep things fair, there's a lottery. Each student ranks all the hospitals, and then there's an algorithm that takes into account the students' preferences and the hospitals' capacity, and assigns each student to a hospital.

Up till ~2015, the algorithm was an RSD ([Random Serial Dictatorship](https://en.wikipedia.org/wiki/Random_serial_dictatorship), more on that soon), which eventually meant that allocations had a pretty random character. Around 2015 however, there has been an "upgrade" to the algorithm which was supposed to make students more satisfied (as a whole) with their assignments [^fn1]. Needless to say, many students were not satisfied with their assignments, which lead to a kind of _folklore_ of strategies to maximize one's odds of getting their desired assignment(s).

The researchers' motivation for the new algorithm was to improve the overall satisfaction of students. And before going into details, this changed the aforementioned strategies. And this leads me to my motivations for looking into this thing.

First, as I mentioned, my wife, she's going to participate in this lottery, and we wanted to test different strategies and measure their outcome. Secondary is my curiosity of figuring out how this thing works.

Before talking about the algorithm, I need to set up some notations.

There are {%raw%}$M${%endraw%} hospitals, each has a capacity of {%raw%}$C_i${%endraw%}.

There are {%raw%}$N${%endraw%} students, each has its own ranking of how they prefer the hospitals. Student {%raw%}$i${%endraw%} ranks the hospitals in a list {%raw%}$R_i = \left(r_{i,1},...,r_{i,M}\right)${%endraw%}.

Back to the new algorithms. It's actually composed of 3 steps:

1. Run RSD a large amount of times. Then collect the results from all the runs to calculate the probability a student {%raw%}$i${%endraw%} gets hospital {%raw%}$j${%endraw%} ({%raw%}$p_{i,j}${%endraw%}).
2. Successively trade probabilities between students to maximize a goal "happiness" (which depends on their preferences and calculated probabilities).
3. Make assignments based on the improved probabilities. A sort of _weighted lottery_, if you will.

This is all very well, but to actually test the implementation, we need input data. This means we need the preferences of *all* the students. That's 270 lists of 25 items. This information is not publicly available.

## Generating the initial data set

What *is* available is a summary of preferences. It's a table (actually a matrix {%raw%}$Q \in \mathbb{N}^{M \times M}${%endraw%}) that summarizes the amount of students which ranked hospital {%raw%}$j${%endraw%} as their {%raw%}$i${%endraw%}'th choice.

What can we do with that? Well, remember the preference list {%raw%}$R_i${%endraw%}? It's basically a vector, and it can be rewritten like this: {%raw%}$R_i = \left(r_{i,1},...,r_{i,M}\right) = \left(\rho_i(1), ..., \rho_i(M)\right)${%endraw%} where {%raw%}$\rho_i: [1,M] \rightarrow [1,M]${%endraw%} is a permutation function that maps a hospital to a preference. This means we can write the preference vector as {%raw%}$R_i = \left[\rho_i\right] \cdot \left(1, ..., M\right)^t = \left[\rho_i\right] \cdot H${%endraw%}. 

If the student ranked hospital j at preference i, then the matrix {%raw%}$\left[\rho_i\right]${%endraw%} will have a 1 in row/column i/j, and 0 at the rest of the row i and column i.

Which means, that if we sum all the permutation matrices of all students, and we look at the resulting matrix at row/colum i/i, we will see how many students made that choice!

{% raw %} $$ Q = \sum_{i=1}^{N} \left[\rho_i\right] $$ {% endraw %}

Why is this insight important? Because if we normalize {%raw%}$Q${%endraw%} by {%raw%}$N${%endraw%}, we get what's called a [Doubly Stochastic Matrix](https://en.wikipedia.org/wiki/Doubly_stochastic_matrix), which according to the Birkhoff–von Neumann theorem can be decomposed in the following manner:

{% raw %} $$ \frac{1}{N} Q = \tilde Q = \sum_{i} \theta_i P_i $$ {% endraw %}

Where {%raw%}$P_i${%endraw%} are permutation matrices and {%raw%}$0 \leq \theta_i \leq 1${%endraw%}.

We can apply the same theorem to decompose {%raw%}$Q${%endraw%} directly:

{% raw %} $$ Q = \sum_{i} n_i P_i $$ {% endraw %}

Where {%raw%}$P_i${%endraw%} are (still) permutation matrices and {%raw%}$n_i${%endraw%} will be the number of students that have that specific permutation. Of course {%raw%}$\sum n_i = N${%endraw%}.

The algorithm used to perform such a decomposition is the [Birkhoff algorithm](https://en.wikipedia.org/wiki/Birkhoff_algorithm). Time to go off on a tangent about the Birkhoff algorithm.

## Birkhoff algorithm

Starting with {%raw%}$Q_0 = Q${%endraw%} the outline of the algorithm is as follows (for step i):

1. Construct the positivity matrix {%raw%}$Q^{+}_i${%endraw%} (has a 1 everywhere {%raw%}$Q_i${%endraw%} is positive)
2. Convert {%raw%}$Q^{+}_i${%endraw%} to a [bipartate graph](https://en.wikipedia.org/wiki/Bipartite_graph) {%raw%}$G_i${%endraw%} with the rows being the left vertices, and the columns being the right ones.
3. Find a perfect matching of {%raw%}$G_i${%endraw%}, which is a set of edges {%raw%}$\hat{G}_i${%endraw%}.

   A property of a matching is that no two edges have a common vertex.

   This corresponds to the equivalent row/column in the matrix containing only one 1. Combined with the matching being perfect (covering all vertices, i.e. having {%raw%}$M${%endraw%} edges), corresponds to a matrix that's doubly-stochastic.

   There are two questions here:

   - How does one find a perfect matching? This is a type of [maximum cardinality matching](https://en.wikipedia.org/wiki/Maximum_cardinality_matching), specifically the [Hopcroft–Karp algorithm](https://en.wikipedia.org/wiki/Hopcroft%E2%80%93Karp_algorithm) is a good one.
   - How are we guaranteed that the matching will be perfect in this situation? Open question for the reader to ponder :)
4. Convert the matching back to a matrix {%raw%}$P_i${%endraw%}
5. Find the smallest element of {%raw%}$Q_i${%endraw%} when masked by {%raw%}$P_i${%endraw%}:

   {%raw%}$$n_i = \min\left\lbrace Q_i \circ P_i\right\rbrace$${%endraw%}

   Where {%raw%}$\circ${%endraw%} is the [Hadamard product](https://en.wikipedia.org/wiki/Hadamard_product_(matrices)).
6. We can now emit the {%raw%}$Q_i${%endraw%} matrix {%raw%}$n_i${%endraw%} times
7. {%raw%}$Q_{i+1} = Q_i - n_i P_i${%endraw%}

   When {%raw%}$Q_{i+1} = O${%endraw%} we're done.

Let's look at an example.

### Example

We'll try to decompose the following matrix:

{% raw %} $$
Q_0 = \begin{pmatrix}
3 & 2 & 1 \\
3 & 3 & 0 \\
0 & 1 & 5
\end{pmatrix}
$$ {% endraw %}

The positivity matrix is:

{% raw %} $$
Q^{+}_0 = \begin{pmatrix}
1 & 1 & 1 \\
1 & 1 & 0 \\
0 & 1 & 1
\end{pmatrix}
$$ {% endraw %}

Which corresponds to the following bipartate graph (numbers for row vertices, letters for column vertices):

![Bipartate0](/assets/internship-lottery/birkhoff/bipartate0.gv.png){: .center-image }

It's pretty easy to find a perfect matching manually ({%raw%}$1a, 2b, 3c${%endraw%}):

![Bipartate0 Matching](/assets/internship-lottery/birkhoff/bipartate0-matching.gv.png){: .center-image }
 
This corresponds to the matrix:

{% raw %} $$
P_0 = \begin{pmatrix}
1 & 0 & 0 \\
0 & 1 & 0 \\
0 & 0 & 1
\end{pmatrix}
$$ {% endraw %}

And the coefficient:

{% raw %} $$
n_0 = \min\left\lbrace Q_0 \circ P_0\right\rbrace = \begin{pmatrix}
3 & 0 & 0 \\
0 & 3 & 0 \\
0 & 0 & 5
\end{pmatrix} = 3
$$ {% endraw %}

Next iteration (now faster):

{% raw %} $$
Q_1 = Q_0 - 3 P_0 = \begin{pmatrix}
0 & 2 & 1 \\
3 & 0 & 0 \\
0 & 1 & 2
\end{pmatrix}
\rightarrow
Q^{+}_1 = \begin{pmatrix}
0 & 1 & 1 \\
1 & 0 & 0 \\
0 & 1 & 1
\end{pmatrix}
$$ {% endraw %}

The corresponding graph and its matching:

![Bipartate1 Matching](/assets/internship-lottery/birkhoff/bipartate1-matching.gv.png){: .center-image }

Which gives us:

{% raw %} $$
P_1 = \begin{pmatrix}
0 & 1 & 0 \\
1 & 0 & 0 \\
0 & 0 & 1
\end{pmatrix}
$$ {% endraw %}

{% raw %} $$
n_1 = \min\left\lbrace Q_1 \circ P_1\right\rbrace = \begin{pmatrix}
0 & 2 & 0 \\
3 & 0 & 0 \\
0 & 0 & 2
\end{pmatrix} = 2
$$ {% endraw %}

Last iteration:

{% raw %} $$
Q_2 = Q_1 - 2 P_1 = \begin{pmatrix}
0 & 0 & 1 \\
1 & 0 & 0 \\
0 & 1 & 0
\end{pmatrix} = Q^{+}_2
$$ {% endraw %}

Let's take a shortcut here as it's pretty obvious this is the last permutation matrix. The decomposition is:

{% raw %} $$
Q = \begin{pmatrix}
3 & 2 & 1 \\
3 & 3 & 0 \\
0 & 1 & 5
\end{pmatrix} = 
3 \begin{pmatrix}
1 & 0 & 0 \\
0 & 1 & 0 \\
0 & 0 & 1
\end{pmatrix} + 
2 \begin{pmatrix}
0 & 1 & 0 \\
1 & 0 & 0 \\
0 & 0 & 1
\end{pmatrix} + 
\begin{pmatrix}
0 & 0 & 1 \\
1 & 0 & 0 \\
0 & 1 & 0
\end{pmatrix}
$$ {% endraw %}

### Implementation

This wouldn't really be a programming blog without code, so there (using [numpy](https://numpy.org/) and [networkx](https://networkx.org/)):

```py
from typing import Iterator, Tuple

import numpy as np
import networkx as nx
from networkx import from_numpy_matrix
from networkx.algorithms.bipartite.matching import maximum_matching

def birkhoff(Q: np.matrix) -> Iterator[Tuple[int, np.matrix]]:
    while not np.all(Q == 0):
        # 1. Construct the positivity matrix of Q (Qp = Q-positive)
        Qp = np.zeroes_like(Q)
        Qp[Q.nonzero()] = 1

        # 2. Convert the positivity matrix to bipartate graph
        Z = np.zeros_like(G, dtype=int)
        # Exapnd to a bipartate matrix (rows and columns map to different nodes)
        B = np.block([[Z, G, G.T, Z])
        G = nx.from_numpy_matrix(B)

        # 3. Find the perfect matching edges (Gh = G-hat)
        Gh = maximum_matching(G, range(M))

        # 4. Convert the matching edges back to a matrix
        # We need to "fold" the vertices of the matching edges, as columns
        # are mapped to the range [M, 2M - 1]
        edges = set((x % M, y % M) for x, y in Gh.items())
        # Create a matrix from the edges
        P = np.zeroes_like(Q)
        P[list(edges)] = 1

        # 5. Find the coefficient
        n = (P * Q).min()

        # 6. Emit result
        yield n, P

        # 7. Prepare next iteration
        Q -= n * P
```

Now that we have a dataset to work on, we can continue with the implementation of the assignment algorithm. Stay tuned.

# References

[^fn1]: Bronfman, S., Hassidim, A., Afek, A. et al. Assigning Israeli medical graduates to internships. Isr J Health Policy Res 4, 6 (2015). [https://doi.org/10.1186/2045-4015-4-6](https://doi.org/10.1186/2045-4015-4-6)
