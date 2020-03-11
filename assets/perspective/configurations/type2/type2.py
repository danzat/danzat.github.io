template = r'''\documentclass[border=5pt, convert={density=120,outext=.png}]{standalone}
\usepackage[dvipsnames]{xcolor}
\usepackage{tikz}
\begin{document}
\begin{tikzpicture}
    \coordinate (a) at (2, 1);
    \coordinate (b) at (3, 2);
    \draw[fill, OliveGreen] (a) circle (2pt) node[anchor=east] {$x$} -- (b) circle (2pt) node[anchor=west] {$y$};

    \coordinate (c) at (2.1, 2.1);
    \coordinate (d) at (3.9, 1.1);
    \draw[fill, OliveGreen] (c) circle (2pt) node[anchor=east] {$z$} -- (d) circle (2pt) node[anchor=west] {$w$};
\end{tikzpicture}
\end{document}'''

def assign(x, y, z, w):
    return template.replace('$x$', f'${x}$').replace('$y$', f'${y}$').replace('$z$', f'${z}$').replace('$w$', f'${w}$')

coords = dict(
    a = (2, 1),
    b = (3, 2),
    c = (2.1, 2.1),
    d = (3.9, 1.1),
)

def side(p, seg):
    f, t = seg
    v1 = (p[0] - f[0], p[1] - f[1])
    v2 = (t[0] - f[0], t[1] - f[1])
    cross = v1[0] * v2[1] - v1[1] * v2[0]
    if cross < 0:
        return 'l'
    else:
        return 'r'

def process(conf):
    x, y, z, w = tuple(conf)
    a = coords[x]
    b = coords[y]
    c = coords[z]
    d = coords[w]

    A = side(a, (c, d))
    B = side(b, (c, d))
    C = side(c, (a, b))
    D = side(d, (a, b))

    filename = 'abcd'.replace('a', A).replace('b', B).replace('c', C).replace('d', D)
    with open(filename + '.tex', 'w') as f:
        f.write(assign(x, y, z, w))


conf = 'abcd'
process(conf)
conf_prime = conf.replace('a', 'x').replace('c', 'a').replace('x', 'c')
conf_prime = conf_prime.replace('b', 'x').replace('d', 'b').replace('x', 'd')
process(conf_prime)
