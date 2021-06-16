function shuffle(array) {
    let current_index = array.length;
    let random_index;

    while (current_index != 0) {
        random_index = Math.floor(Math.random() * current_index);
        current_index--;

        [array[current_index], array[random_index]] = [array[random_index], array[current_index]];
    }

    return array;
}

let iteration = 0;

class Matrix {
    constructor(size) {
        let matrix = new Array(size);
        for (let i = 0; i < size; i++) {
            matrix[i] = new Array(size);
            for (let j = 0; j < size; j++) {
                matrix[i][j] = 0;
            }
        }
        this.m = matrix;
        this.size = size;
    }

    imap(func) {
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                this.m[i][j] = func(i, j, this.m[i][j]);
            }
        }
    }

    map(func) {
        let result = new Matrix(this.size);
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                result.m[i][j] = func(i, j, this.m[i][j]);
            }
        }
        return result;
    }

    iadd(other) {
        if (this.size != other.size) throw Error("iadd: size mismatch");
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                this.m[i][j] += other.m[i][j];
            }
        }
    }

    isub(other) {
        if (this.size != other.size) throw Error("iadd: size mismatch");
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                this.m[i][j] -= other.m[i][j];
            }
        }
    }
    
    scale(alpha) {
        return this.map((i, j, v) => alpha * v);
    }

    add(other) {
        if (this.size != other.size) throw Error("add: size mismatch");
        let result = new Matrix(this.size);
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                result.m[i][j] = this.m[i][j] + other.m[i][j];
            }
        }
        return result;
    }

    hadamard(other) {
        if (this.size != other.size) throw Error("add: size mismatch");
        let result = new Matrix(this.size);
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                result.m[i][j] = this.m[i][j] * other.m[i][j];
            }
        }
        return result;
    }

    positivity() {
        return this.map((i, j, v) => (v > 0 ? 1 : 0));
    }

    isZero() {
        return this.m.flat().reduce((res, v) => res && v == 0, true);
    }

    asTex(transform) {
        let formatted = "\\begin{pmatrix}";
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                let value = this.m[i][j];
                if (transform != undefined) {
                    value = transform(i, j, value);
                }
                formatted += ` ${value} `;
                if (j < (this.size - 1)) {
                    formatted += "&";
                }
            }
            if (i < (this.size - 1)) {
                formatted += "\\\\"
            }
        }
        formatted += "\\end{pmatrix}";
        return formatted;
    }

    static fromPermutation(permutation) {
        let result = new Matrix(permutation.length);
        for (let i = 0; i < permutation.length; i++) {
            result.m[i][permutation[i]] = 1;
        }
        return result;
    }
}

class BipartateGraph {
    constructor(matrix) {
        this.m = matrix;
        this.size = this.m.size;
    }

    render(id, edges) {
        const canvas = document.getElementById(id);
        const ctx = canvas.getContext('2d');

        const { width, height } = canvas.getBoundingClientRect();
        canvas.width = canvas.height * (canvas.clientWidth / canvas.clientHeight);

        ctx.clearRect(0, 0, width, height);

        const vertical = height / (this.m.size + 1); 

        const top = vertical;
        const left = vertical;
        const radius = 0.5 * (vertical / 2);
        const right = width - vertical;

        for (let i = 0; i < this.size; i++) {
            let from_y = top + i * vertical;
            for (let j = 0; j < this.size; j++) {
                let to_y = top + j * vertical;
                if (this.m.m[i][j]) {
                    if (edges && edges[i] == j) {
                        ctx.strokeStyle = "red";
                        ctx.lineWidth = 2;
                    }
                    ctx.beginPath();
                    ctx.moveTo(left, from_y);
                    ctx.lineTo(right, to_y);
                    ctx.stroke();
                    ctx.strokeStyle = "black";
                    ctx.lineWidth = 1;
                }
            }
        }

        for (let i = 0; i < this.size; i++) {
            let l = new Path2D();
            let r = new Path2D();

            let y = top + i * vertical;
            l.arc(left, y, radius, 0, 2 * Math.PI, false);
            r.arc(right, y, radius, 0, 2 * Math.PI, false);

            ctx.fillStyle = "white";
            ctx.fill(l);
            ctx.fill(r);
            ctx.strokeStyle = "black";
            ctx.stroke(l);
            ctx.stroke(r);
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = `${radius}px serif`;
            ctx.fillStyle = "black";
            ctx.fillText(String(i), left, y);
            ctx.fillText(String.fromCharCode(i + "a".charCodeAt(0)), right, y);
        }
    }

    maximumMatching() {
        let q = [];
        let left = [...Array(this.size).keys()];
        let right = left.map((i) => i + this.size);

        let G = {};

        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                if (this.m.m[i][j] == 1) {
                    let l = i;
                    let r = j + this.size;
                    if (!(l in G)) {
                        G[l] = [];
                    }
                    if (!(r in G)) {
                        G[r] = [];
                    }
                    G[l].push(r);
                    G[r].push(l);
                }
            }
        }

        let left_matches = Object.fromEntries(left.map(x => [x, null]));
        let right_matches = Object.fromEntries(right.map(x => [x, null]));
        let dist = Object.fromEntries(left.map(x => [x, 0]));

        function bfs() {
            let queue = [];
            for (let u of left) {
                if (left_matches[u] == null) {
                    dist[u] = 0;
                    queue.push(u);
                } else {
                    dist[u] = Infinity;
                }
            }

            dist[null] = Infinity;

            while (queue.length > 0) {
                let u = queue.shift();
                if (dist[u] < dist[null]) {
                    for (let v of G[u]) {
                        let match = right_matches[v];
                        if (dist[match] == Infinity) {
                            dist[match] = dist[u] + 1;
                            queue.push(match);
                        }
                    }
                }
            }

            return dist[null] != Infinity;
        }

        function dfs(u) {
            if (u != null) {
                for (let v of G[u]) {
                    let match = right_matches[v];
                    if (dist[match] == (dist[u] + 1)) {
                        if (dfs(match)) {
                            right_matches[v] = u;
                            left_matches[u] = v;
                            return true;
                        }
                    }
                }
                dist[u] = Infinity;
                return false;
            }
            return true;
        }

        while (bfs()) {
            for (let u in left) {
                if (left_matches[u] == null) {
                    dfs(u);
                }
            }
        }
        return Object.entries(left_matches).map(x => [x[0], x[1] - this.size]);
    }
}

function renderTEX(id, tex) {
    let element = document.getElementById(id);
    element.innerText = `$$${tex}$$`;
    MathJax.Hub.Typeset(element);
}

class Demo {
    constructor(hospitals, students) {
        this.size = hospitals.length;
        this.hospital_names = hospitals;
        this.iteration = 0;
        this.state = 0
        this.Q = new Matrix(this.size);

        this.hospitals = [...Array(this.size).keys()];

        for (let i = 0; i < students; i++) {
            let p = shuffle(this.hospitals.slice());
            this.Q.iadd(Matrix.fromPermutation(p));
        }

        let preferences = document.getElementById("preferences");
        let thead = preferences.createTHead();
        let row = thead.insertRow();
        row.insertCell().innerText = "#";
        for (let i of this.hospitals) {
            row.insertCell().innerText = i;
        }

        this.prefs_tbody = preferences.createTBody();

        this.next();
    }

    emitPreference() {
        let row = this.prefs_tbody.insertRow();
        let preference = this.M.m.map(row => row.indexOf(1));
        row.insertCell().innerText = `${this.p}x`;
        for (let i of preference) {
            row.insertCell().innerText = this.hospital_names[i];
        }
    }

    clear() {
        for (let id of ["matrix", "positivity", "matching", "mask"]) {
            document.getElementById(id).innerText = "";
        }
        const canvas = document.getElementById("graph");
        const ctx = canvas.getContext('2d');
        const { width, height } = canvas.getBoundingClientRect();
        canvas.width = canvas.height * (canvas.clientWidth / canvas.clientHeight);
        ctx.clearRect(0, 0, width, height);
    }

    stepTitle(text) {
        let title = document.getElementById("step");
        title.innerText = `Iteration #${this.iteration}: ${text}`;
    }

    next() {
        switch (this.state) {
            case 0:
                this.clear();
                this.stepTitle("");
                renderTEX("matrix", `Q_{${this.iteration}}=${this.Q.asTex()}`);
                if (!this.Q.isZero()) {
                    this.state++;
                }
                break;
            case 1:
                this.stepTitle("Calculate poisitity matrix");
                this.Qp = this.Q.positivity();
                renderTEX("positivity", `Q^{+}_{${this.iteration}}=${this.Qp.asTex()}`);
                this.state++;
                break;
            case 2: {
                this.stepTitle("Convert to a bipartate graph");
                this.G = new BipartateGraph(this.Qp);
                this.G.render("graph");
                this.state++;
                break;
            }
            case 3: {
                this.stepTitle("Find a maximum matching");
                this.matching = this.G.maximumMatching();
                this.G.render("graph", Object.fromEntries(this.matching));
                this.state++;
                break;
            }
            case 4: {
                this.stepTitle("Conver the matching to a matrix");
                this.M = new Matrix(this.size);
                for (let edge of this.matching) {
                    this.M.m[edge[0]][edge[1]] = 1;
                }
                renderTEX("matching", `M_{${this.iteration}}=${this.M.asTex()}`);
                this.state++;
                break;
            }
            case 5: {
                this.stepTitle("Determine multiplier and emit result");
                this.QM = this.Q.hadamard(this.M);
                this.p = Math.min(...this.QM.m.map(row => Math.min(...row.filter(x => x != 0))));
                this.emitPreference();
                let formatted = this.QM.asTex((i, j, v) => ((v == this.p) ? `\\mathbf{${v}}` : v));
                renderTEX("mask", `Q_{${this.iteration}} \\circ M_{${this.iteration}} =${formatted}`);
                this.state++;
                break;
            }
            case 6: {
                this.stepTitle("Prepare for next step");
                this.iteration++;
                this.Q.isub(this.M.scale(this.p));
                this.state = 0;
                this.next();
                break;
            }
            default:
                break;
        }
    }
}

var demo;

window.onload = function() {
    demo = new Demo(["Mayo Clinic", "Johns Hopkins", "Charité", "MGH"], 20);
};
