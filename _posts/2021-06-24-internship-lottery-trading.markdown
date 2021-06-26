---
layout: post
title:  "Internship Lottery"
subtitle: "Probability Trading"
date:   2021-06-24
categories: algorithm
custom_css: rsd
custom_js: rsd
---

As mentioned in the previous post, the new lottery is composed of 3 steps:

1. Simulate a large amount of RSDs and collect the results.
2. Successivly trade assignments between students to maximize satisfaction
3. Use the new assignments to produce a final assignment that's acceptable on all parties.

What is this RSD? What does "trading" mean? Is this "final" assignemnt?

To understand what each step means, we need to understand the previous step that feeds it. So let's start with RSD.

## Random Serial Dictatorship

This is how the assignment used to work. And it was a pretty straightforward lottery:

1. A student's names is pulled out of a bag
2. They are assigned their highest ranking preference that's still available (i.e. the hospital still has vacancies)
3. The assigned hospital's vacancies is decreased by 1.
4. Back to (1), until all students were assigned.

```py
from random import sample

def match(preferences: list[int], hospitals: list[int]) -> int:
    for preference in preferences:
        if hospital[preference] > 0:
            return preference

def rsd(
    students: dict[str, list[int]],
    hospitals: list[int]
) -> Iterator[tuple[int, int]]:
    remaining = hospitals.copy()
    for student, preferences in sample(students.items(), k=len(students)):
        allocation = match(preferences, remaining)
        yield student, allocation
        remaining[allocation] -= 1
```

### Example

In this example, there are 10 students ranking 4 hospitals (represented by colored squares).

On the left, are the students' preferences from highest (left) to lowest (right).

On the right, are the hospitals' vacancies. A full block is free, while an empty is clear.

The demo will cycle through the students, trying to grab the highest vacant position for each one. Which will be marked by a full square:

<div id="single-rsd-demo">
    <div id="single-rsd-view"></div>
    <div class="controls">
        <button id="start" onclick="single_rsd_demo.start()">
            <span class="material-icons">play_arrow</span>
            <span>(Re)Start</span>
        </button>
        <button id="start" onclick="single_rsd_demo.shuffle()">
            <span class="material-icons">shuffle</span>
            <span>Shuffle</span>
        </button>
    </div>
</div>

### Assignment Trading

It is not unlikely, that due to the random nature of the lottery, one student might get an assignment that favorable to someone else. If this is mutual, then the two students can trade assignments. This is actually common in practice.

Sometimes, there are more complex cases where more than two students are involved in a "chain" of trades (which benefit all of them).

## Assignment Probability & Happiness

As you can probably tell from playing with the example above, the assignment results are pretty random. We would like to eliminate the randomness and examine whether there's some underlying order.

To do that, we will run the same RSD, but with many different picking order (shuffle the order in which students get to pick a hospital out of the hat). For each draw, we will record the result, and display the accumulated time each student got his i<sup>th</sup> preference (visualized as vertical colored bars):

<div id="multi-rsd-demo">
    <div class="rsd-demo" id="multi-rsd">
        <div id="counter">Rounds: 0</div>
        <div class="hospitals"></div>
        <div class="students"></div>
    </div>
    <div class="controls">
        <button id="start" onclick="multi_rsd_demo.start()">
            <span class="material-icons">play_arrow</span>
            <span>Start</span>
        </button>
        <button id="start" onclick="multi_rsd_demo.stop()">
            <span class="material-icons">stop</span>
            <span>Stop</span>
        </button>
        <button id="start" onclick="multi_rsd_demo.reshuffle()">
            <span class="material-icons">shuffle</span>
            <span>Shuffle</span>
        </button>
    </div>
</div>

As you can see, after several thousands of RSD rounds, the results stabilize. At this point, we can say that each student has a certain probability of obtaining each of their preferences.

Formally, for each student, we count the number of times they got assigned their i<sup>th</sup> preference:

{%raw%}$$
\mathbf{n} = \left(n_1, ..., n_M\right)
$${%endraw%}

If we divide this number by the amount of runs {%raw%}$n_{RSD}${%endraw%}, we obtain an assignment probability:

{%raw%}$$
p_i = \frac{n_i}{n_{RSD}}
$${%endraw%}

For each student, we define the student's happiness by calculating a weighted sum of their assignment probabilities:

{%raw%}$$
h = p_1 M^2 + p_2 \left(M-1\right)^2 + ... + p_M 1^2 = \sum_{i=1}^M p_i \left(M - i + 1\right)^2 = \mathbf{w}^T \cdot \mathbf{p}
$${%endraw%}

## Probability Trading

Extrapolating from the concept of assignment trading, we introduce a new concept called **probability trading**.

Suppose we have two students A and B with assignment probabilities {%raw%}$\mathbf{p}_A${%endraw%} and {%raw%}$\mathbf{p}_B${%endraw%}.

We define "trading of probabilities" between the student. Student A can give a portion of their probability to be assigned to hospital i to student B, and in return, student B will give the same portion to student A.

### Single probability trading

Since probability can be traded only between the same hospital, it will do us good to rewrite the formulas a bit.

For a student A, we define their preference mapping as {%raw%}$\pi_A : \mathrm{Hospital} \rightarrow \mathrm{Preference}${%endraw%}.

If we store the assignment probabilities sorted by hospital, rather than preference, we can rewrite the happiness as:

{%raw%}$$
h_A = \sum_{i \in \mathrm{Hospital}} w_{\pi_A(i)} p_{A,i} = \mathbf{w}^T \cdot \mathbf{\pi_A} \cdot \mathbf{p_A}
$${%endraw%}

In the simplest case, only one "dose" of probability is traded between students:

1. A gives up a chance of q to get hospital i (and B gains that chance)
2. B gives up an equal chance q to get hospital j (and A gains that chance)

In terms of happiness, A lost {%raw%}$q \cdot w_{\pi_A(i)}${%endraw%} and gained {%raw%}$q \cdot w_{\pi_A(j)}${%endraw%}, whereas B lost {%raw%}$q \cdot w_{\pi_B(j)}${%endraw%} and gained {%raw%}$q \cdot w_{\pi_B(i)}${%endraw%}:

{%raw%}$$
\begin{eqnarray}
\hat{h}_A = h_A - q w_{\pi_A(i)} + q w_{\pi_A(j)} = h_A + q \left(w_{\pi_A(j)} - w_{\pi_A(i)}\right)\\
\hat{h}_B = h_B - q w_{\pi_B(j)} + q w_{\pi_B(i)} = h_B + q \left(w_{\pi_B(i)} - w_{\pi_B(j)}\right)
\end{eqnarray}
$${%endraw%}

Since we want the trade to be mutually beneficial, we must require:

{%raw%}$$
\begin{eqnarray}
\Delta_A = q \left(w_{\pi_A(j)} - w_{\pi_A(i)}\right) & \gt & 0 \\
\rightarrow w_{\pi_A(j)} & \gt & w_{\pi_A(i)} \\
\rightarrow \left(M - \pi_A(j) + 1\right)^2 & \gt & \left(M - \pi_A(i) + 1\right)^2 \\
\rightarrow 1 \leq \pi_A(j) & \lt & \pi_A(i) \leq M \\
\Delta_B = q \left(w_{\pi_B(i)} - w_{\pi_B(j)}\right) & \gt & 0 \\
\rightarrow 1 \leq \pi_B(i) & \lt & \pi_B(j) \leq M \\
\end{eqnarray}
$${%endraw%}

Which means, we can only trade between specific hospitals:

{%raw%}$$
\mathrm{Trades} = \left\lbrace i, j \in \mathrm{Hospitals} : \pi_A(j) \lt \pi_A(i) \land \pi_B(i) \lt \pi_B(j)\right\rbrace
$${%endraw%}

We want to find the size of the traded probability which maximizes the overall increase in happiness:

{%raw%}$$
\Delta = q \left(w_{\pi_A(j)} - w_{\pi_A(i)} + w_{\pi_B(i)} - w_{\pi_B(j)}\right)
$${%endraw%}

In addition, we have the following constraints:

{%raw%}$$
\begin{eqnarray}
q & \leq & p_{A,i} \\
q & \leq & p_{B,j} \\
p_{A,j} + q & \leq & 1 \\
p_{B,i} + q & \leq & 1
\end{eqnarray}
$${%endraw%}

Which can be summarized as:

{%raw%}$$
q \leq \min \left\lbrace p_{A,i}, p_{B,j}, 1 - p_{A,j}, 1 - p_{B,i}\right\rbrace
$${%endraw%}

Since the target function {%raw%}$\Delta${%endraw%} is linear in {%raw%}$q${%endraw%}, to maximize it, we just need to select {%raw%}$q${%endraw%} to be the largest possible value under the constraints. So we take {%raw%}$q${%endraw%} on the edge of the boundary (the other end of the boundary is 0, which matches the minimum):

{%raw%}$$
\overline{q}_{i,j} = \min \left\lbrace p_{A,i}, p_{B,j}, 1 - p_{A,j}, 1 - p_{B,i}\right\rbrace
$${%endraw%}

The above is true for a specific selection of i, j. To find the overall maximum, we need to consider all possible trades:

{%raw%}$$
\overline{q} = \max_{\mathrm{Trades}} \overline{q}_{i,j} \left(w_{\pi_A(j)} - w_{\pi_A(i)} + w_{\pi_B(i)} - w_{\pi_B(j)}\right)
$${%endraw%}

```py
W = {h: (M - i + 1)**2 for i, h in enumerate(Hospitals)}

class Student:
    pi: Dict[Hospital, int]
    p: List[float]

    def give(self, h: Hospital, p: float):
        this.p[h] -= p

    def receive(self, h: Hospital, p: float):
        this.p[h] += p

    @property
    def happiness() -> float:

def feasable_trades(
    A: Student,
    B: Student
) -> Iterator[Tuple[Hospital, Hospital]]:
    for i, j in pairs(A.pi.keys()):
        if A.pi[j] < A.pi[i] and B.pi[i] < B.pi[j]:
            yield i, j

def iterate_all(
    A: Student,
    B: Student
) -> Iterator[Tuple[float, Hospital, Hospital]]:
    for i, j in feasable_trades(A, B):
        p = min(A[i], B[j], 1 - A[j], 1 - B[i])
        # Increase in overall happiness
        delta = p * (W[A.pi[j]] - W[A.pi[i]] + W[B.pi[i]] - W[B.pi[j]])
        yield delta, p, i, j

def optimal_trade(A: List[float], B: List[float]):
    _, p, i, j = max(iterate_all(A, B), operator.itemgetter(0))
    A.give(i, p)
    B.receive(i, p)
    B.give(j, p)
    A.receive(j, p)
```

## Probability Trading Demo

Click through next to cycle mutually beneficial trades.

The number on the top is the happiness of each student (1 being the highest).

The numbers on the colored bars represent the amount of traded assignments.

<div id="trader-demo">
    <div id="trade">
        <div class="students"></div>
    </div>
    <div class="controls">
        <button id="start" onclick="trader_demo.next()">
            <span class="material-icons">play_arrow</span>
            <span>Next</span>
        </button>
        <button id="start" onclick="trader_demo.reset()">
            <span class="material-icons">shuffle</span>
            <span>Reset</span>
        </button>
    </div>
</div>
