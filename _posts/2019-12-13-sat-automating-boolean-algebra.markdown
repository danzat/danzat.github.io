---
layout: post
title:  "SAT"
subtitle: "Automating Boolean Algebra"
date:   2019-10-22
categories: algorithms sat
---

I recently ran into a problem that I thought would be nice to solve using satisfiability (SAT). I quickly understood though that it would be unfeasible, but I got curious anyway.

So I thought I might try and build my own logic proof engine so I can play around with, benchmark, and maybe optimize.

Before I dive in, I'll quickly describe the problem, and then break it down into steps.

### Motivation

My original problem was to check whether a list of arithmetic and logic operations can produce a certain result. In other words __Is it possible that output X was produced by a program P?__

So what's a program? It's a series of instructions that manipulate a state. The initial state can be thought of as an input, and the final state (or some part of it) is the output.

In any real-world situation, the state is comprised of a set of variables (and memory locations), each of which is of a fixed size of bits.

The initial state can be a combination of known and unknown bits. For example, we might know a certain 32bit word's 24 high bits are 0, and the lowest 8 are unknown:

```
word = 00000000 00000000 00000000 abcdefgh
```

At each step of the program, the bits of the word get "tangled" and accrue logic complexity.

For example, if we want to add 1 to the following 8bit number: `(0, a, 0, a, 0, a, 0, a)`, we will use a full adder (LINK), which will result in `(0, a, 0, a, 0, a, a, a⊕1)` (with `⊕` being the XOR operation).

It's easy to see that with non trivial computations, the logical expressions for each bit can get very complex.

(CONTINUE TALKING ABOUT CNF AND SAT SOLVING)

So, step #1: we need a way to comfortably construct parametric logic expression. We will also need a way to simplify them to a certain form (LINK TO CNF)

I chose to implement everything in Python as it's very easy to code and is highly expressive.

## Boolean Algebra

# Bit

The basic building block will be a boolean variable. All a variable has is a name:

```python
class Bit:
    def __init__(self, name):
        self._name = name
    def __repr__(self):
        return self._name
```

# The And/Or Operators

The next thing we would want to do is perform operations on these variables. There are two basic operators in boolean algebra: "∨" (or) and "∧" (and).

Classically, they are binary operators, meaning they operate on two variables, but they can operate on several variables using the [associative property](https://en.wikipedia.org/wiki/Associative_property):

(A ∨ B) ∨ C = A ∨ (B ∨ C) = A ∨ B ∨ C

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
1. [Associativity](https://en.wikipedia.org/wiki/Associative_property): `(a ∨ b) ∨ c = a ∨ b ∨ c`
2. [Distributivity](https://en.wikipedia.org/wiki/Distributive_property): `a ∧ (b ∨ c) = (a ∧ b) ∨ (a ∧ c)`
2. [Commutativity](https://en.wikipedia.org/wiki/Commutative_property): `a ∧ b = b ∧ a`
3. [Idempotence](https://en.wikipedia.org/wiki/Idempotence) of the logic operators:
 - `a ∧ a = a`
 - `a ∨ a = a`

```
(a ∨ b) ∧ (b ∨ (c ∧ a)) =
    ((a ∨ b) ∧ b) ∨ ((a ∨ b) ∧ (c ∧ a)) =
    (a ∧ b) ∨ (b ∧ b) ∨ (a ∧ (c ∧ a)) ∨ (b ∧ (c ∧ a)) =
    (a ∧ b) ∨ b ∨ (a ∧ a ∧ c) ∨ (a ∧ b ∧ c) =
    (a ∧ b) ∨ b ∨ (a ∧ c) ∨ (a ∧ b ∧ c)
```

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

# Associativity (a.k.a. flattening)

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

# Commutativity & Idempotence (a.k.a. remove duplicates)

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
        return self.__class__(*result)
    def simplify(self):
        return self.flatten().remove_duplicates()

>>> a | b | a | b
(((a ∨ b) ∨ a) ∨ b)
>>> simplify(_)
(a ∨ b)
```

# Distributivity

Suppose we are walking over the operands of an And clause and we encounter an Or:

```
a ∧ b ∧ c ∧ (e ∨ f)
```

We want to take all the operands we encountered up till then (`a ∧ b ∧ c`) consider them a single clause (`x = a ∧ b ∧ c`) and distribute the expression `x ∧ (e ∨ f)`:

```python
class And(Clause):
    # ...
    def simplify(self):
        result = []
        for operand in super(And, self).simplify():
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

## Not

So far we have ignored the Not(¬) operation. Let's work it in:

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

# De-Morgan

We have two more simplification rules for Not. Namely, the [De-Morgan laws](https://en.wikipedia.org/wiki/De_Morgan%27s_laws):
1. ¬(a ∧ b) = ¬a ∨ ¬b
2. ¬(a ∨ b) = ¬a ∧ ¬b

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

# XOR

We can also define a convenience method for the XOR operation:

```python
class BooleanExpression:
    # ...
    def __xor__(self, other):
        return (self & ~other) | (~self & other)
```

# Identity, Null and Cancellation

Now, we want to be able to cancel things out. What does canceling out mean? It depends on the operator:
- a ∧ ¬a = 0
- a ∨ ¬a = 1

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
- ¬0 = 1
- ¬1 = 0
- a ∧ 0 = 0
- a ∧ 1 = a
- a ∨ 0 = a
- a ∨ 1 = 1

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

For the And and Or rules, we can notice a certain common pattern, namely, for each operator there's one literal that's neutral to the operator, and another that "nullifies" it:

```python
class Clause(BooleanExpression):
    # ...
    def remove_duplicates(self):
        result = []
        for operand in sorted(self):
            if result and result[-1] == operand:
                continue # Drop the duplicate
            elif result and ~result[-1] == operand:
                result = [self.NULL]
                break
            elif operand == self.IDENTITY:
                continue # Does nothing to the result
            elif operand == self.NULL:
                result = [self.NULL]
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
```

### N-bit word

Now that we have all the basic building blocks ready, let's try and put this mechanism to work. We'll define a word as an array of bits:

```python
class Word:
    def __init__(self, bits):
        self._bits = bits
    def __iter__(self):
        return iter(self._bits))
```

What can we do with it? We can implement addition ([full adder](https://en.wikipedia.org/wiki/Adder_(electronics)))!

```python
class Word:
    # ...
    def __add__(self, other):
        carry = FALSE
        res = []
        for a, b in zip(self, other):
            res.append(a ^ b ^ carry)
            carry = (a & b) | (carry & (a ^ b))
        return Word(map(simplify, res), simplify(carry)
```
