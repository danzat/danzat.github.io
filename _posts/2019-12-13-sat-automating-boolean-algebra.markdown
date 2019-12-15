---
layout: post
title:  "SAT"
subtitle: "Automating Boolean Algebra"
date:   2019-12-13
categories: algorithms sat
---

I recently ran into a problem that I thought would be nice to solve using satisfiability (SAT). I quickly understood though that it would be unfeasible, but I got curious anyway.

So I thought I might try and build my own logic proof engine so I can play around with, benchmark, and maybe optimize.

Before I dive in, I'll quickly describe the problem, and then break it down into steps.

# Motivation

My original problem was to check whether a list of arithmetic and logic operations can produce a certain result. In other words _"Is it possible that output X was produced by a program P?"_

So what's a program? It's a series of instructions that manipulate a state. The initial state can be thought of as an input, and the final state (or some part of it) is the output.

In any real-world situation, the state is comprised of a set of variables (and memory locations), each of which is of a fixed size of bits.

The initial state can be a combination of known and unknown bits. For example, we might know a certain 32bit word's 24 high bits are 0, and the lowest 8 are unknown:

```
word = 00000000 00000000 00000000 abcdefgh
```

At each step of the program, the bits of the word get "tangled" and accrue logic complexity.

For example, if we want to add 1 to the following 8bit number: `(0, a, 0, a, 0, a, 0, a)`, we will use a [full adder](https://en.wikipedia.org/wiki/Adder_(electronics)), which will result in `(0, a, 0, a, 0, a, a, a⊕1)` (with `⊕` being the XOR operation).

It's easy to see that with non trivial computations, the logical expressions for each bit can get very complex.

So, step #1: we need a way to comfortably construct parametric logic expression. We will also need a way to simplify them to a certain form (called [Disjunctive Normal Form](https://en.wikipedia.org/wiki/Disjunctive_normal_form), but we'll talk about it later).

I chose to implement everything in Python as it's very easy to code and is highly expressive.

## Boolean Algebra

### Bit

The basic building block will be a boolean variable. All a variable has is a name:

```python
class Bit:
    def __init__(self, name):
        self._name = name
    def __repr__(self):
        return self._name
```

### The And/Or Operators

The next thing we would want to do is perform operations on these variables. There are two basic operators in boolean algebra: "∨" (or) and "∧" (and).

Classically, they are binary operators, meaning they operate on two variables, but they can operate on several variables using the [associative property](https://en.wikipedia.org/wiki/Associative_property):

{% raw %}
$$(A \vee B) \vee C = A \vee (B \vee C) = A \vee B \vee C$$
{% endraw %}

So we have the notion of a clause with an operator type:

```python
class Or:
    def __init__(self, *operands):
        self._operands = operands
    def __repr__(self):
        return '(' + ' ∨ '.join(map(repr, self._operands)) +')'
```

Notice that the code for the `And` operator would be exactly the same, except for the `__repr__`. Hint: This won't be the only similarity between them, so let's join them together:

```python
class Clause:
    def __init__(self, *operands):
        self._operands = operands
    def __iter__(self):
        return iter(self._operands)
    def __repr__(self):
        return '(' + self.DELIMITER.join(map(repr, self)) +')'

class Or(Clause):
    DELIMITER = ' ∨ '

class And(Clause):
    DELIMITER = ' ∧ '
```

We can test it out:

```python
>>> And(Bit('a'), Or(Bit('b'), Bit('c')))
(a ∧ (b ∨ c))
```

Let's go one extra step for the sake on convenience, and overload Python operators. To do this we will need to say that both `Bit` and `Clause` are a type of `BooleanExpression`:

```python
class BooleanExpression:
    def __or__(self, other):
        return Or(self, other)
    def __and__(self, other):
        return And(self, other)

class Bit(BooleanExpression):
    # ...

class Clause(BooleanExpression):
    # ...
```

Now we can write:

```python
>>> a, b, c = Bit('a'), Bit('b'), Bit('c')
>>> (a | b) & (b | (c & a))
((a ∨ b) ∧ (b ∨ (c ∧ a)))
```

Ok...what was that mess? Well this is something we could potentially encounter after performing some sort of computation using the variables a, b and c.

It is possible to simplify the expression. If we were to use pen and paper, we would iteratively apply the following properties:
1. [Associativity](https://en.wikipedia.org/wiki/Associative_property): {% raw %} $(a \vee b) \vee c = a \vee b \vee c$ {% endraw %}
2. [Distributivity](https://en.wikipedia.org/wiki/Distributive_property): {% raw %} $a \wedge (b \vee c) = (a \wedge b) \vee (a \wedge c)$ {% endraw %}
2. [Commutativity](https://en.wikipedia.org/wiki/Commutative_property): {% raw %} $a \wedge b = b \wedge a$ {% endraw %}
3. [Idempotence](https://en.wikipedia.org/wiki/Idempotence) of the logic operators:
 - {% raw %} $a \wedge a = a$ {% endraw %}
 - {% raw %} $a \vee a = a$ {% endraw %}

For example:

{% raw %}
$$
\begin{eqnarray*}
(a \vee b) \wedge (b \vee (c \wedge a)) & = & ((a \vee b) \wedge b) \vee ((a \vee b) \wedge (c \wedge a)) \\
& = & (a \wedge b) \vee (b \wedge b) \vee (a \wedge (c \wedge a)) \vee (b \wedge (c \wedge a)) \\
& = & (a \wedge b) \vee b \vee (a \wedge a \wedge c) \vee (a \wedge b \wedge c) \\
& = & (a \wedge b) \vee b \vee (a \wedge c) \vee (a \wedge b \wedge c)
\end{eqnarray*}
$$
{% endraw %}

## Simplification

It would be nice if we could perform the above steps automatically.

Let's start by setting up a framework for applying simplification. We generally want to start with simplifying inner expressions, and then proceeding outwards. Additionally, each type of expression might have its own simplification rules (e.g. distributivity is something driven by And rather than Or).

```python
def simplify(expression):
    expression.map(simplify)
    return expression.simplify()

class BooleanExpression:
    # ...
    def map(self, fn):
        pass
    def simplify(self):
        return self

class Clause(BooleanExpression):
    # ...
    def map(self, fn):
        self._operands = list(map(fn, self))
```

### Associativity (a.k.a. flattening)

What this basically means is flattening nested operators of the same type. This is true for both `And` and `Or`:

```python
class Clause(BooleanExpression):
    # ...
    def flatten(self):
        result = []
        for operand in self:
            if operand.__class__ == self.__class__:
                result.extend(operand)
            else:
                result.append(operand)
        return self.__class__(*result)
    def simplify(self):
        return self.flatten()

>>> a, b, c, d = Bit('a'), Bit('b'), Bit('c'), Bit('d')
>>> a & b & c & d
(((a ∧ b) ∧ c) ∧ d)
>>> simplify(_)
(a ∧ b ∧ c ∧ d)
```

### Commutativity & Idempotence (a.k.a. remove duplicates)

In the previous section, we saw that a flat expression can still be simplified by removing duplicates (idempotence). To do that we need to find them. The easiest way would be to rearrange the order of the clause so that similar variables appear together. This would make it easy to spot duplicates.

BTW, this rearrangement is possible due to the commutative property.

To rearrange the clause, we would want to sort it. To do this, we must specify some sort of ordering between all the primitives we defined.

We want all the `Bit`s to appear on the left, grouped by their name, and then we want the rest.

This implies to levels of ordering:

```python
class BooleanExpression:
    # ...
    def __lt__(self, other):
        if self.__class__ == other.__class__:
            return self.order() < other.order()
        return self.ORDER < other.ORDER

class Bit(BooleanExpression):
    # ...
    ORDER = 0
    def order(self):
        return self._name

class Clause(BooleanExpression):
    # ...
    ORDER = 1
    def order(self):
        return 0
```

And we also need a way to tell if two operands are equal:

```python
class BooleanExpression:
    # ...
    def __eq__(self, other):
        if self.__class__ == other.__class__:
            return self.equals(other)
        return False

class Bit(BooleanExpression):
    # ...
    def equals(self, other):
        return self._name == other._name

from itertools import zip_longest

class Clause(BooleanExpression):
    # ...
    def equals(self, other):
        return all(a == b for a, b in zip_longest(sorted(self), sorted(other)))

>>> a == a
True
>>> a == b
False
>>> a & b == a & b
True
>>> a & b == a & c
False
>>> a & b == b & a
True
```

We can now remove duplicates:

```python
class Clause(BooleanExpression):
    # ...
    def remove_duplicates(self):
        result = []
        for operand in sorted(self):
            if result and result[-1] == operand:
                continue # Drop the duplicate
            result.append(operand)
        return result
    def _simplify(self):
        return self.flatten().remove_duplicates()
    def simplify(self):
        result = self._simplify()
        if len(result) == 1:
            return result[0]
        return self.__class__(*result)

>>> a | b | a | b
(((a ∨ b) ∨ a) ∨ b)
>>> simplify(_)
(a ∨ b)
```

### Distributivity

Suppose we are walking over the operands of an And clause and we encounter an Or:

{% raw %}
$$a \wedge b \wedge c \wedge (e \vee f)$$
{% endraw %}

We want to take all the operands we encountered up till then ({% raw %} $a \wedge b \wedge c$ {% endraw %}) consider them a single clause ({% raw %} $x = a \wedge b \wedge c$ {% endraw %}) and distribute the expression {% raw %} $x \wedge (e \vee f)$ {% endraw %}:

```python
class And(Clause):
    # ...
    def simplify(self):
        result = []
        for operand in self._simplify():
            if isinstance(operand, Or):
                temp = A(*result)
                distributed = [A(temp, subop) for subop in operand]
                result = [simplify(O(*distributed))]
            else:
                result.append(operand)
        if len(res) == 1: # And(x) == x
            return res[0]
        return A(*res)
```

Let's try with the initial example:
```python
>>> (a | b) & (b | (c & a))
((a ∨ b) ∧ (b ∨ (c ∧ a)))
>>> simplify(_)
(b ∨ (a ∧ b) ∨ (a ∧ c) ∨ (a ∧ b ∧ c))
```

Exactly like the manual calculation!

### Not

So far we have ignored the Not({% raw %} $\neg$ {% endraw %}) operation. Let's work it in:

```python
class Not(BooleanExpression):
    ORDER = 1
    def __init__(self, operand):
        self._operand = operand
    def __repr__(self):
        return f'¬{self._operand}'

class BooleanExpression:
    # ...
    def __invert__(self):
        return Not(self)
```

We can think about the Not operator as if it "does" something to its inner operand.

For example, we can say a Bit can have an additional property of being inverted:

```python
class Bit(BooleanExpression):
    def __init__(self, name, inverted = False):
        self._name = name
        self._inverted = inverted
    def __repr__(self):
        sign = '¬{' if self._inverted else ''
        return f'{sign}{self._name}'
    def equals(self, other):
        return self._inverted == other._inverted and self._name == other._name
```

We can now define the following simplification rules for Not:

```python
class Not(BooleanExpression):
    # ...
    def simplify(self):
        inner = self._operand
        if isinstance(inner, Bit):
            return Bit(expr._name, not expr._inverted)
        elif isinstance(inner, Not):
            return inner.operand
        else:
            return self

>>> ~a
¬a
>>> ~~a
¬¬a
>>> simplify(_)
a
```

### De-Morgan

We have two more simplification rules for Not. Namely, the [De-Morgan laws](https://en.wikipedia.org/wiki/De_Morgan%27s_laws):
{% raw %}
$$
\begin{eqnarray*}
\neg(a \wedge b) & = & \neg a \vee \neg b \newline
\neg(a \vee b) & = & \neg a \wedge \neg b
\end{eqnarray*}
$$
{% endraw %}

```python
class Not(BooleanExpression):
    # ...
    def simplify(self):
        inner = self._operand
        # ...
        elif isinstance(inner, Or):
            return simplify(And(*[Not(op) for op in inner]))
        elif isinstance(inner, And):
            return simplify(Or(*[Not(op) for op in inner]))
        else:
            return self

>>> a & b & ~c
((a ∧ b) ∧ ¬c)
>>> ~(a & b & ~c)
¬((a ∧ b) ∧ ¬c)
>>> simplify(_)
(¬a ∨ ¬b ∨ c)
```

### XOR

XOR (exclusive or) is defined as:

{% raw %} $$ a \oplus b = (a \vee \neg b) \wedge (\neg a \vee b) $$ {% endraw %}

We can also define a convenience method for the XOR operation:

```python
class BooleanExpression:
    # ...
    def __xor__(self, other):
        return (self & ~other) | (~self & other)
```

### Identity, Null and Cancellation

Now, we want to be able to cancel things out. What does canceling out mean? It depends on the operator:
{% raw %}
$$
\begin{eqnarray*}
a \wedge \neg a & = & 0 \newline
a \vee \neg a & = & 1
\end{eqnarray*}
$$
{% endraw %}

First let's add these new literals to our code:

```python
class Literal(BooleanExpression):
    ORDER = 0
    def __init__(self, value):
        self._value = value
    def __repr__(self):
        return repr(self._value)

FALSE = Literal(0)
TRUE = Literal(1)
```

These new literals have their own unique properties with regard to operators:
- {% raw %} $ \neg 0 = 1 $ {% endraw %}
- {% raw %} $ \neg 1 = 0 $ {% endraw %}
- {% raw %} $ a \wedge 0 = 0 $ {% endraw %}
- {% raw %} $ a \wedge 1 = a $ {% endraw %}
- {% raw %} $ a \vee 0 = a $ {% endraw %}
- {% raw %} $ a \vee 1 = 1 $ {% endraw %}

```python
class Not(BooleanExpression):
    def simplify(self):
        inner = self._operand
        # ...
        elif inner == TRUE:
            return FALSE
        elif inner == FALSE:
            return TRUE
        else:
            return self
```

For the ∧(And) and ∨(Or) rules, we can notice a certain common pattern, namely, for each operator there's one literal that's neutral to the operator, and another that "nullifies" it:

```python
class Clause(BooleanExpression):
    # ...
    def remove_duplicates(self):
        result = []
        for operand in sorted(self):
            if result and result[-1] == operand:
                continue # Drop the duplicate
            elif result and simplify(~result[-1]) == operand:
                result = [self.NULL]
                break
            elif operand == self.IDENTITY:
                continue # Does nothing to the result
            elif operand == self.NULL:
                result = [self.NULL]
                break
            else:
                result.append(operand)
        if not result:
            result = [self.IDENTITY]
        return self.__class__(*result)

class And(Clause):
    # ...
    NULL = FALSE
    IDENTITY = TRUE

class Or(Clause):
    # ...
    NULL = TRUE
    IDENTITY = FALSE

>>> a ^ a
((a ∧ ¬a) ∨ (¬a ∧ a))
>>> simplify(a ^ a)
0
```

# N-bit word

Now that we have all the basic building blocks ready, let's try and put this mechanism to work. We'll define a word as an array of bits:

```python
class Word:
    def __init__(self, bits):
        self._bits = bits
    def __iter__(self):
        return iter(self._bits))
    def __repr__(self):
        return '{' + ', '.join(map(repr, self)) + '}'
```

What can we do with it? We can implement addition ([full adder](https://en.wikipedia.org/wiki/Adder_(electronics)))!

```python
class Word:
    # ...
    def __add__(self, other):
        carry = FALSE
        result = []
        for a, b in zip_longest(self, other):
            if a is None:
                a = FALSE
            if b is None:
                b = FALSE
            result.append(a ^ b ^ carry)
            carry = (a & b) | (carry & (a ^ b))
        return self.__class__(map(simplify, result)), simplify(carry)

>>> x = Word([a, a, a])
>>> x
{a, a, a}
>>> x + x
({0, a, a}, a)
>>> one = Word([TRUE])
>>> x + one
({¬a, 0, 0}, a)
>>> Word([a, b]) + Word([c, d])
({((a ∧ ¬c) ∨ (¬a ∧ c)), ((¬a ∧ b ∧ ¬d) ∨ (¬a ∧ ¬b ∧ d) ∨ (b ∧ ¬c ∧ ¬d) ∨ (¬b ∧ ¬c ∧ d) ∨ (a ∧ b ∧ c ∧ d) ∨ (a ∧ ¬b ∧ c ∧ ¬d))}, ((b ∧ d) ∨ (a ∧ b ∧ c ∧ ¬d) ∨ (a ∧ ¬b ∧ c ∧ d)))
```


What can we do with this? Well, just as an example, let's take the following function on an 8bit number:

```c
uint8_t hash(uint8_t n)
{
    return n + (n ^ 37) + (ror(n, 3) & 201);
}
```

We can ask, is it possible this computation gives as the result 249?

To do that, we can contruct the exact expression for the result of this function.

First, let's buff the capabilities of our `Word`:

```python
class Word:
    # ...
    def __and__(self, other):
        return self.__class__([simplify(x & y) for x, y in zip(self, other)])
    def __xor__(self, other):
        return self.__class__([simplify(x ^ y) for x, y in zip(self, other)])
    def ror(self, amount):
        return self.__class__(self._bits[amount:] + self._bits[:amount])

class Byte(Word):
    def __init__(self, bits):
        if len(bits) < 8:
            self._bites = bits + (8 - len(bits)) * [FALSE]
        else:
            self._bits = bits[:8]
    def __add__(self, other):
        result, _ = super().__sum__(other)
        return result
    @staticmethod
    def from_uint(v):
        bits = []
        for i in range(8):
            bits.append(Literal(v % 2))
            v = v // 2
        return Byte(bits)
```

Now we can do this:

```python
def hash(n):
    return n + (n ^ Byte.from_uint(37)) + (n.ror(3) & Byte.from_uint(201))

>>> hash(Byte([a, b, c, d, e, f, g, h]))
{¬d, d, ¬b, ((b ∧ ¬g) ∨ (¬b ∧ g)), ((¬b ∧ d) ∨ (d ∧ ¬g) ∨ (b ∧ ¬d ∧ g)), ((¬b ∧ ¬e) ∨ (¬d ∧ ¬e) ∨ (¬e ∧ ¬g) ∨ (b ∧ d ∧ e ∧ g)), ((¬b ∧ e) ∨ (¬b ∧ ¬d ∧ e) ∨ (b ∧ ¬d ∧ ¬e) ∨ (¬b ∧ e) ∨ (¬b ∧ e ∧ ¬g) ∨ (b ∧ ¬e ∧ ¬g)), ((¬b ∧ ¬c ∧ g) ∨ (¬b ∧ c ∧ ¬g) ∨ (¬b ∧ ¬c ∧ ¬e ∧ g) ∨ (¬b ∧ c ∧ ¬e ∧ ¬g) ∨ (¬b ∧ ¬c ∧ ¬d ∧ g) ∨ (¬b ∧ c ∧ ¬d ∧ ¬g) ∨ (¬c ∧ ¬d ∧ ¬e ∧ g) ∨ (c ∧ ¬d ∧ ¬e ∧ ¬g) ∨ (¬b ∧ ¬c ∧ e ∧ g) ∨ (¬b ∧ c ∧ e ∧ ¬g) ∨ (¬b ∧ c ∧ ¬g) ∨ (c ∧ ¬e ∧ ¬g) ∨ (¬b ∧ ¬c ∧ ¬e ∧ g) ∨ (¬b ∧ c ∧ ¬e ∧ ¬g) ∨ (b ∧ ¬c ∧ e ∧ ¬g) ∨ (b ∧ c ∧ e ∧ g) ∨ (b ∧ c ∧ d ∧ ¬e ∧ g))}
```

We want this array of bits to have some concrete value:

```python
>>> for x, y in zip(hash(n), Byte.from_uint(249)):
    print(f'{y} = {x}')
1 = ¬d
0 = d
0 = ¬b
1 = ((b ∧ ¬g) ∨ (¬b ∧ g))
1 = ((¬b ∧ d) ∨ (d ∧ ¬g) ∨ (b ∧ ¬d ∧ g))
1 = ((¬b ∧ ¬e) ∨ (¬d ∧ ¬e) ∨ (¬e ∧ ¬g) ∨ (b ∧ d ∧ e ∧ g))
1 = ((¬b ∧ e) ∨ (¬b ∧ ¬d ∧ e) ∨ (b ∧ ¬d ∧ ¬e) ∨ (¬b ∧ e) ∨ (¬b ∧ e ∧ ¬g) ∨ (b ∧ ¬e ∧ ¬g))
1 = ((¬b ∧ ¬c ∧ g) ∨ (¬b ∧ c ∧ ¬g) ∨ (¬b ∧ ¬c ∧ ¬e ∧ g) ∨ (¬b ∧ c ∧ ¬e ∧ ¬g) ∨ (¬b ∧ ¬c ∧ ¬d ∧ g) ∨ (¬b ∧ c ∧ ¬d ∧ ¬g) ∨ (¬c ∧ ¬d ∧ ¬e ∧ g) ∨ (c ∧ ¬d ∧ ¬e ∧ ¬g) ∨ (¬b ∧ ¬c ∧ e ∧ g) ∨ (¬b ∧ c ∧ e ∧ ¬g) ∨ (¬b ∧ c ∧ ¬g) ∨ (c ∧ ¬e ∧ ¬g) ∨ (¬b ∧ ¬c ∧ ¬e ∧ g) ∨ (¬b ∧ c ∧ ¬e ∧ ¬g) ∨ (b ∧ ¬c ∧ e ∧ ¬g) ∨ (b ∧ c ∧ e ∧ g) ∨ (b ∧ c ∧ d ∧ ¬e ∧ g))
```

So we essentially have a system of boolean equations with 8 variables (`a` through `h`) and we want to know if there's a solution.

Let's try to solve manually (I will use {%raw%}$\top${%endraw%} to indicate a truth statement, and to {%raw%}$\bot${%endraw%} indicate a contradiction):
1. {%raw%}$1 = \neg d \Rightarrow d = 0${%endraw%}
2. {%raw%}$0 = d \Rightarrow \top${%endraw%}
3. {%raw%}$0 = \neg b \Rightarrow b = 1${%endraw%}
4. {%raw%}$1 = (b \wedge \neg g) \vee (\neg b \wedge g) = \neg g \vee 0 = \neg g \Rightarrow g = 0${%endraw%}
5. {%raw%}$1 = (\neg b \wedge d) \vee (d \wedge \neg g) \vee (b \wedge \neg d \wedge g) = 0 \vee 0 \vee g = g \Rightarrow \bot${%endraw%}

We don't need to continue because we have reached a contradiction ("g" can't be both 0 and 1). Therefore there is no possible solution for this system of equations, so there exists no number n so that {%raw%}$hash(n) = 249${%endraw%}.

The manual process of working out each equation, extracting invariants and evaluating expressions is something that we would want to automate, much like the process of simplifying boolean expressions. This will be the topic of the following post.
