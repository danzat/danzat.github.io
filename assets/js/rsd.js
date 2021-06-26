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

const zip = (a, b) => a.map((k, i) => [k, b[i]]);

class RSDView {
    constructor(root_id, inventory, colors) {
        this.students_dom_map = [];
        this.hospitals_dom_map = [];

        let root = $(`#${root_id}`);

        let inventory_dom = $("<div/>")
            .attr("class", "inventory")
            .appendTo(root);
        for (const [vacancies, color] of zip(inventory, colors)) {
            let hospital = $("<div/>")
                .attr("class", "hospital")
                .appendTo(inventory_dom);
            let dom_map = [];
            for (let i = 0; i < vacancies; i++) {
                let square = $("<div/>")
                    .attr("class", "square-on")
                    .css("background-color", color)
                    .appendTo(hospital); 
                dom_map.push(square);
            }
            this.hospitals_dom_map.push(dom_map)
        }

        let students = $("<div/>")
            .attr("class", "students")
            .appendTo(root);
        for (const vacancies of inventory) {
            for (let i = 0; i < vacancies; i++) {
                let column = $("<div/>")
                    .attr("class", "ranking")
                    .appendTo(students);
                let dom_map = [];
                for (let j = 0; j < inventory.length; j++) {
                    let square = $("<div/>")
                        .attr("class", "square-off")
                        .appendTo(column); 
                    dom_map.push(square);
                }
                this.students_dom_map.push(dom_map);
            }
        }
    }

    reset() {
        this.hospitals_dom_map.flat().forEach(x => x.attr("class", "square-on"));
        this.students_dom_map.flat().forEach(x => x.attr("class", "square-off"));
    }

    getHospitalSlot(hospital, slot) {
        return this.hospitals_dom_map[hospital][slot];
    }

    getStudentPreference(student, preference) {
        return this.students_dom_map[student][preference];
    }
}

function shuffle(array) {
    let i = array.length;
    let sigma_i;

    while (i != 0) {
        sigma_i = Math.floor(Math.random() * i);
        i--;

        [array[i], array[sigma_i]] = [array[sigma_i], array[i]];
    }

    return array;
}

class SingleRSD {
    constructor(root_id, inventory, colors) {
        this.view = new RSDView(root_id, inventory, colors);
        this.colors = colors;
        this.original_inventory = inventory;
        this.inventory = [...inventory];
        this.hospitals = [...inventory.keys()];
        this.n_students = inventory.reduce((x, y) => x + y, 0);
        this.reshuffle();
    }

    reset() {
        this.inventory = [...this.original_inventory];
        this.view.reset();
    }

    reshuffle() {
        let view = this.view;
        let colors = this.colors;
        this.shuffeled = [];
        for (let i = 0; i < this.n_students; i++) {
            let ranking = shuffle([...this.hospitals]);
            ranking.forEach(
                (hospital, j) => view.getStudentPreference(i, j)
                .css("background-color", colors[hospital])
            );
            this.shuffeled.push(ranking);
        }
    }

    done() {
        return this.inventory.every(v => v == 0);
    }

    highlight(student, preference) {
        this.view.getStudentPreference(student, preference)
            .attr("class", "square-current");
    }

    lowlight(student, preference) {
        this.view.getStudentPreference(student, preference)
            .attr("class", "square-off");
    }

    acquire(student, preference) {
        this.view.getStudentPreference(student, preference)
            .attr("class", "square-on");
    }

    consumeHospital(hospital) {
        const current = this.original_inventory[hospital] - this.inventory[hospital] - 1;
        this.view.getHospitalSlot(hospital, current)
            .attr("class", "square-off");
    }

    *loop() {
        let student = 0;
        let i = 0;
        while (!this.done()) {
            this.highlight(student, i);
            yield
            let hospital = this.shuffeled[student][i];
            if (this.inventory[hospital] > 0) {
                this.inventory[hospital]--;
                this.consumeHospital(hospital);
                this.acquire(student, i);
                yield
                student++;
                i = 0;
            } else {
                this.lowlight(student, i);
                i++;
                if (i > (this.n_hospitals - 1)) {
                    i = 0;
                    student++;
                }
            }
        }
    }
}

class SingleRSDDemo {
    constructor(inventory, colors) {
        this.rsd = new SingleRSD("single-rsd-view", inventory, colors);
        this.reset();
    }

    reset() {
        this.rsd.reset();
        this.iter = this.rsd.loop();
    }

    next() {
        this.iter.next();
    }

    start() {
        if (this.iid) {
            window.clearInterval(this.iid);
        }
        this.reset();
        let demo = this;
        this.iid = window.setInterval(function(){
            demo.next();
        }, 250);
    }

    shuffle() {
        this.rsd.reshuffle();
        this.rsd.reset();
    }
}

function rsd(preferences, vacancies_) {
    let students = shuffle([...Array(preferences.length).keys()]);
    let vacancies = {...vacancies_};
    let assignments = {};
    for (const student of students) {
        const ranking = preferences[student];
        let i = 0;
        for (const hospital of ranking) {
            if (vacancies[hospital] > 0) {
                vacancies[hospital]--;
                assignments[student] = i;
                break;
            }
            i++;
        }
    }
    return assignments;
}

function genPreferences(n_students, n_hospitals) {
    let preferences = [];
    for (let i = 0; i < n_students; i++) {
        var ranking;
        do {
            ranking = shuffle([...Array(n_hospitals).keys()]);
        } while (ranking[0] > 1);
        preferences.push([...ranking]);
    }
    return preferences;
}

class MultiRSDDemo {
    constructor(vacancies, colors) {
        this.n_students = vacancies.reduce((x, y) => x + y, 0);
        this.n_hospitals = vacancies.length;
        this.vacancies = vacancies;
        this.colors = colors;
        this.root = document.getElementById("multi-rsd");
        this.reshuffle();
    }

    reshuffle() {
        this.preferences = genPreferences(this.n_students, this.n_hospitals);
        this.steps = 0;
        this.total = {};
        for (let i = 0; i < this.n_students; i++) {
            this.total[i] = new Array(this.n_hospitals).fill(0);
        }
        this.prepareDOM();
    }

    prepareDOM() {
        let students_div = this.root.getElementsByClassName("students")[0];
        students_div.querySelectorAll("*").forEach(x => x.remove());
        for (let row of this.preferences) {
            let student_row = document.createElement("div");
            students_div.insertAdjacentElement("beforeend", student_row);
            for (let hospital of row) {
                let outer = document.createElement("div");
                outer.setAttribute("class", "outer");
                let square = document.createElement("div");
                square.setAttribute("class", "square");
                square.style.backgroundColor = this.colors[hospital];
                square.style.width = 0;
                outer.insertAdjacentElement("beforeend", square);
                outer.style.backgroundColor = `${this.colors[hospital]}22`;
                student_row.insertAdjacentElement("beforeend", outer);
            }
        }

        let hospitals_div = this.root.getElementsByClassName("hospitals")[0];
        hospitals_div.querySelectorAll("*").forEach(x => x.remove());
        for (let i = 0; i < this.n_hospitals; i++) {
            let row = document.createElement("div");
            hospitals_div.insertAdjacentElement("beforeend", row);
            for (let j = 0; j < this.vacancies[i]; j++) {
                let square = document.createElement("div");
                square.setAttribute("class", "square-on");
                square.style.backgroundColor = this.colors[i];
                row.insertAdjacentElement("beforeend", square);
            }
        }
    }

    getCell(i, j) {
        return this.root.getElementsByClassName("students")[0].children[i].children[j].children[0];
    }

    step() {
        let assignments = rsd(this.preferences, this.vacancies);
        for (let [student, preference] of Object.entries(assignments)) {
            this.total[student][preference]++;
        }
        this.steps++;
        document.getElementById("counter").innerText = `Rounds: ${this.steps}`;
        for (let i = 0; i < this.n_students; i++) {
            for (let j = 0; j < this.n_hospitals; j++) {
                let cell = this.getCell(i, j);
                let width = Math.round(20 * this.total[i][j] / this.steps);
                cell.style.width = `${width}px`;
            }
        }
    }

    start() {
        let demo = this;
        this.iid = window.setInterval(function() {
            demo.step();
        }, 10);
    }

    stop() {
        window.clearInterval(this.iid);
    }
}

var single_rsd_demo;
var multi_rsd_demo;


function multi_rsd_shuffle() {
}

/* RSD trading demo */

class Student {
    constructor(id, hospitals) {
        this.id = id;
        // Hospitals by order of preference (#0 is most wanted)
        this.preferences = shuffle(hospitals);
        // Map from hospital to preference
        this.pi = Object.fromEntries(Object.entries(this.preferences).map(e => [e[1], Number(e[0])]));
        // Number of rounds each hospital was assigned
        this.n = new Array(hospitals.length).fill(0);
    }

    happiness() {
        const M = this.n.length;
        const W = [...Array(M).keys()].map(i => (M - i) ** 2);
        let h = 0;
        for (let i = 0; i < M; i++) {
            h += this.n[i] * W[this.pi[i]];
        }
        return h;
    }

    give(hospital, n) {
        this.n[hospital] -= n;
    }

    receive(hospital, n) {
        this.n[hospital] += n;
    }
}

function rsd2(students_, vacancies_) {
    let students = shuffle([...students_]);
    let vacancies = [...vacancies_];
    let assignments = {};
    for (const student of students) {
        for (const hospital of student.preferences) {
            if (vacancies[hospital] > 0) {
                vacancies[hospital]--;
                assignments[student.id] = hospital;
                break;
            }
        }
    }
    return assignments;
}

function* feasable_trades(A, B) {
    const M = A.preferences.length;
    for (let i = 0; i < M; i++) {
        for (let j = 0; j < M; j++) {
            if (i == j) continue;
            if (A.pi[j] < A.pi[i] && B.pi[i] < B.pi[j]) yield [i, j];
        }
    }
}

function* iterate_all(A, B) {
    const N = A.n.reduce((x, y) => x + y, 0);
    const M = A.preferences.length;
    const W = [...Array(M).keys()].map(i => (M - i) ** 2);
    for (const [i, j] of feasable_trades(A, B)) {
        let q = Math.min(A.n[i], B.n[j], N - A.n[i], N - B.n[j]);
        if (q == 0) {
            continue;
        }
        let delta = q * (W[A.pi[j]] - W[A.pi[i]] + W[B.pi[i]] - W[B.pi[j]]);
        yield [delta, q, i, j]
    }
}

class Trader {
    constructor(vacancies, colors) {
        this.colors = colors;
        this.vacancies = vacancies;
        this.hospitals = [...Array(vacancies.length).keys()];
        this.n_students = vacancies.reduce((x, y) => x + y, 0);
        this.base_happiness = Array(this.n_students).fill(0);
        this.reset();
    }

    reset() {
        this.students = [];
        for (let i = 0; i < this.n_students; i++) {
            this.students.push(new Student(i, [...this.hospitals]));
        }
    }

    initializeDOM() {
        let root = document.getElementById("trade");
        let students_div = root.getElementsByClassName("students")[0];
        students_div.querySelectorAll("*").forEach(x => x.remove());
        for (let student of this.students) {
            let student_column = document.createElement("div");
            student_column.setAttribute("class", "student");
            students_div.insertAdjacentElement("beforeend", student_column);
            let hospitals_column = document.createElement("div");
            hospitals_column.setAttribute("class", "hospitals");
            let happiness = document.createElement("div");
            happiness.setAttribute("class", "happiness");
            let extra_happiness = document.createElement("div");
            extra_happiness.setAttribute("class", "happiness");
            student_column.insertAdjacentElement("beforeend", happiness);
            student_column.insertAdjacentElement("beforeend", extra_happiness);
            student_column.insertAdjacentElement("beforeend", hospitals_column);
            for (let hospital of student.preferences) {
                let outer = document.createElement("div");
                outer.setAttribute("class", "outer");
                let bar = document.createElement("div");
                bar.setAttribute("class", "bar");
                bar.style.backgroundColor = this.colors[hospital];
                bar.style.width = 0;
                outer.insertAdjacentElement("beforeend", bar);

                let annotation = document.createElement("div");
                annotation.setAttribute("class", "annotation");
                outer.insertAdjacentElement("beforeend", annotation);

                outer.style.backgroundColor = `${this.colors[hospital]}22`;
                hospitals_column.insertAdjacentElement("beforeend", outer);
            }
        }
    }

    updateBars() {
        const max_happiness = this.rounds * this.hospitals.length ** 2;
        let root = document.getElementById("trade");
        let students_div = root.getElementsByClassName("students")[0];
        for (const student of this.students) {
            let student_column = this.getStudentColumn(student);
            student_column.getElementsByClassName("happiness")[0].innerText = (student.happiness() / max_happiness).toFixed(3);
            student_column.getElementsByClassName("happiness")[1].innerText = ((student.happiness() - this.base_happiness[student.id]) / max_happiness).toFixed(3);
            let hospitals_column = this.getHospitalsColumn(student);
            for (const [i_, hospital] of Object.entries(student.preferences)) {
                const i = Number(i_);
                let outer = hospitals_column.children[i];
                let bar = outer.children[0];
                let width = 40 * student.n[hospital] / this.rounds;
                bar.style.width = `${width}px`;
            }
        }
    }

    rsd(rounds) {
        this.rounds = rounds;
        for (let i = 0; i < this.rounds; i++) {
            let assignments = rsd2(this.students, this.vacancies);
            for (const [student, hospital] of Object.entries(assignments)) {
                this.students[student].n[hospital]++;
            }
        }
        for (let student of this.students) {
            this.base_happiness[student.id] = student.happiness();
        }
    }

    *studentPairs() {
        for (let A of this.students) {
            for (let B of this.students) {
                if (A.id > B.id) {
                    continue;
                }
                yield [A, B];
            }
        }
    }

    getStudentColumn(student) {
        let root = document.getElementById("trade");
        let students_div = root.getElementsByClassName("students")[0];
        return students_div.children[student.id];
    }

    getHospitalsColumn(student) {
        let student_column = this.getStudentColumn(student);
        return student_column.children[2];
    }

    annotateHospital(student, hospital, text) {
        let row = this.getHospitalsColumn(student);
        let outer = row.children[student.pi[hospital]];
        let annotation = outer.children[1];
        annotation.innerText = text;
    }

    clearStudent(student) {
        let div = this.getStudentColumn(student);
        div.style.border = "";
        div.style.padding = "1px";
    }

    highlightStudent(student) {
        let div = this.getStudentColumn(student);
        div.style.border = "1px solid black";
        div.style.padding = 0;
    }

    *loop() {
        let trades = 0;
        do {
            let trades = 0;
            for (let [A, B] of this.studentPairs()) {
                let values = [...iterate_all(A, B)];
                if (values.length == 0) {
                    continue;
                }
                this.highlightStudent(A);
                this.highlightStudent(B);
                // Visualize trade deltas
                const [_, q, i, j] = values.reduce((prev, curr) => prev[0] < curr[0] ? curr : prev);
                this.annotateHospital(A, i, `-${q}`);
                this.annotateHospital(B, i, `+${q}`);
                this.annotateHospital(A, j, `+${q}`);
                this.annotateHospital(B, j, `-${q}`);
                yield
                this.annotateHospital(A, i, "");
                this.annotateHospital(B, i, "");
                this.annotateHospital(A, j, "");
                this.annotateHospital(B, j, "");
                // A gives B
                A.give(i, q);
                B.receive(i, q);
                // B gives A
                B.give(j, q);
                A.receive(j, q);
                this.updateBars();
                yield
                // Perform trade
                trades++;
                this.clearStudent(A);
                this.clearStudent(B);
            }
        } while (trades > 0);
        console.log("Done");
    }
}

class TraderDemo {
    constructor() {
        const colors = [
            "#FF9AA2",
            "#FFDAC1",
            "#E2F0CB",
            "#B5EAD7",
            "#C7CEEA"
        ];
        this.trader = new Trader([2, 5, 3, 2, 1], colors);
        this.reset();
    }
    
    reset() {
        this.trader.reset();
        this.trader.initializeDOM();
        this.trader.rsd(1000);
        this.trader.updateBars();
        this.iter = this.trader.loop();
    }

    next() {
        this.iter.next();
    }
}

var trader_demo;

window.onload = function() {
    const colors = [
        "#FF9AA2",
        "#FFDAC1",
        "#E2F0CB",
        "#B5EAD7",
        "#C7CEEA"
    ];
    single_rsd_demo = new SingleRSDDemo([2, 5, 2, 1, 4], colors);

    multi_rsd_demo = new MultiRSDDemo([3, 2, 4, 5, 4], colors);

    trader_demo = new TraderDemo();
};

