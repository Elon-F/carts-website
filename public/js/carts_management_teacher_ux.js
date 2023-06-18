let selectedElements = [];
selectedElements.currDate = undefined;
selectedElements.setFirst = (e) => {
    selectedElements.clear()
    selectedElements.start = e;
}

selectedElements.setLast = (e) => {
    // Get the start and end cells
    let start = $(selectedElements.start);
    let end = $(selectedElements.end);
    let newElem = $(e);

    // Get the column and row indices of the cells
    let col = start.index() + 1; // + 1 because no headers
    let startRow = start.parent().index();
    let endRow = end.parent().index();
    let newRow = newElem.parent().index();

    // swap it to ensure the first row is indeed the first row and not the other way around
    if (newRow > endRow) {
        endRow = newRow;
        selectedElements.direction_down = true;
    }
    else if (newRow < startRow) {
        startRow = newRow;
        selectedElements.direction_down = false;
    }
    else if (newRow <= endRow) {// here we have startRow < newRow < endRow, so we want to pick based on the current direction
        if (selectedElements.direction_down) endRow = newRow; else startRow = newRow;
    }
    if (startRow > endRow) [startRow, endRow] = [endRow, startRow];

    // Get all the cells in the same column as start
    let cells = $(`table tr td:nth-child(${col})`);

    // Slice the cells between the start and end rows
    let slice = cells.slice(startRow - 1, endRow); // we remove 1 because the CSS doesn't select headers

    // do any of the nodes in the request range contain bad things?
    let cond = ![user_name, null].includes(e.getAttribute("data-email")) || e.classList.contains("charge") || e.classList.contains("break_row");
    slice.each((i, x) => {cond ||= ![user_name, null].includes(x.getAttribute("data-email")) || x.classList.contains("charge")})
    if (cond) return;
    selectedElements.clean(); // ensure there are no leftover highlights

    // Add a class to highlight the cells
    slice.addClass("highlight");
    slice.first().addClass("highlight_top") // TODO transitions aren't quite right.
    slice.last().addClass("highlight_bot")

    // set current elements based on the slice
    slice.each(k => {
        selectedElements.push(slice[k])
    });
    selectedElements.start = selectedElements[0];
    selectedElements.end = selectedElements[selectedElements.length - 1];
}

selectedElements.clear = () => {
    selectedElements.clean();
    selectedElements.start = null;
    selectedElements.end = null;
    selectedElements.direction_down = true;
}

selectedElements.clean = () => {
    for (let elem of selectedElements) $(elem).removeClass("highlight highlight_top highlight_bot");
    selectedElements.length = 0; // wtf
    document.getElementById("entry_editor")?.remove(); // remove the entry editor
}

function showEntryEditor(cell) {
    let json = getReservationParameters()
    if (!json) return;
    // fetch the square from the server with the JSON as the body. needs to contain the entire selection information, so maybe a list of cells {cart + hours}/ just hours, a date, and a cart for identification
    fetch('/carts/render_editor', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...json})
    }).then(async response => {
        entry_editor = response.text()

        document.getElementById("entry_editor")?.remove();
        editorElement = $(await entry_editor).addClass("entry_editor")[0]

        if (!editorElement) return;
        $(cell).append(editorElement)

        const rect = editorElement.getBoundingClientRect();
        if (rect.right >= (window.innerWidth || document.documentElement.clientWidth)) editorElement.classList.add("right_aligned")
        editorElement.classList.add("entry_editor_animated");

    }).then(() => {
        setupEntryEditorEvents();
        document.getElementById("classLocationInput").focus();
    });

}

let isDragging = false;
$(function () {
    $("td.reservation").on("mousedown", e => {
        if (e.button !== 0 || !e.target.classList.contains("reservation_inner")) return;
        isDragging = true;
        selectedElements.setFirst(e.currentTarget);
        selectedElements.setLast(e.currentTarget);
    }).on("mouseup", e => {
        if (e.button !== 0 || !isDragging) return;
        isDragging = false;
        selectedElements.setLast(e.currentTarget)
        showEntryEditor($(selectedElements.start).find(".reservation_inner")[0])
    }).on("mouseenter", e => {
        if (isDragging) {
            selectedElements.setLast(e.currentTarget)
        }
    }).dblclick(e => {
        // todo UBERSELECTOR
        e.element

    }).hover(e => {
        // TODO weak highlight

    });

    $(document).on('keydown', e => {
        if (e.key === "Escape") {
            selectedElements.clear();
        }
    });

    $(window).on("mouseup", e => { // TODO improve this to be a bit less hacky
        if (e.button !== 0 || !isDragging) return;
        isDragging = false;
        showEntryEditor($(selectedElements.start).find(".reservation_inner")[0])
    });


    const source = new EventSource('/carts/events', {withCredentials: true});
    source.addEventListener('refresh', message => {
        let date = message.data;
        let params = window.location.search.split('?')[1].split('&').reduce((a, v) => ({ ...a, [v.split('=')[0]]: v.split('=')[1]}), {})
        console.log("params", params)
        if (date !== params["date"]) return;
        location.reload(true);
        console.log(`Refreshed ${date} due to event.`)
    });
    if (document.getElementById("v-cal")) vanillaCalendar.init({disablePastDays: true, disableWeekend: true});

});

function setupEntryEditorEvents() {
    $('input[type="checkbox"]').each(toggleNextElem).click(toggleNextElem); // initial setup to ensure everything is properly hidden or shown.
    const form = document.querySelector('form');
    form.addEventListener('submit', submitEntryEditorForm);
}

function toggleNextElem() {
    let cElem = $(this);
    let inputValue = cElem.parent().next();
    inputValue.css("display", cElem.is(":checked") ? "" : "none");
}

function submitEntryEditorForm(event, additional={}) {
    event.preventDefault();

    const data = new FormData(event.target);
    const new_data = new FormData();
    for (let d of data.keys()) {
        let newArr = data.getAll(d).filter(x => x !== "");
        if (newArr.length === 0) continue; else if (newArr[0] === "on" && newArr.length === 2) new_data.set(d, newArr[1]); else if (newArr[0] === "on" && newArr.length === 1) new_data.set(d, ""); else if (d.includes("checkbox") && newArr.length === 1) continue; else new_data.set(d, data.getAll(d))
    }
    const value = Object.fromEntries(new_data.entries());
    let full_data = {...value, ...getReservationParameters(), ...additional}
    let json = JSON.stringify(full_data);

    console.log("Sent form with data", json);

    fetch('carts/update_reservations', {
        method: 'POST', headers: {
            'Accept': 'application/json, text/plain, */*', 'Content-Type': 'application/json'
        }, body: json
    }).then(() => location.reload(true));//.then(res => console.log(res));

}

function submitMailForm() {
    let form = $("form")

    const data = new FormData(form[0]);
    const full_data = Object.fromEntries(data.entries());
    if (!full_data.contents) return;
    let json = JSON.stringify(full_data);

    console.log("Sent email form with data", json);

    let button = $("button[type='submit']");
    fetch('carts/send_email', {
        method: 'POST', headers: {
            'Accept': 'application/json, text/plain, */*', 'Content-Type': 'application/json'
        }, body: json
    }).then(() => {
        button.text("Email Sent!");
        $("textarea").hide();
    });//.then(res => console.log(res));
    button.text("... ... ...").on("click", (e) => {e.preventDefault(); void(0);})
}

function getReservationParameters() {
    let start = $(selectedElements.start);
    let end = $(selectedElements.end);

    // Get the column and row indices of the cells
    let col = start.index(); // + 1 because headers
    let startRow = start.parent().index() - 1; // parent is row
    let endRow = end.parent().index() - 1;
    let column = $("table tr td:nth-child(1)");
    let headerStart = column[startRow]?.innerHTML; // TODO use tags / classes instead

    if (headerStart === "Break") { // TODO move logic out of here...
        startRow += 1;
        headerStart = column[startRow].innerHTML;
    }

    let headerEnd = column[endRow]?.innerHTML; // check if it's a break, if so grab the header one down.
    if (headerEnd === "Break") {
        endRow -= 1;
        headerEnd = column[endRow].innerHTML;
    }
    if (!headerEnd || !headerStart) return false; // if not defined..
    return {
        cartName: $(".table th")[col].innerHTML,
        start: parseInt(headerStart.split(" ").slice(-1)) - 1,
        end: parseInt(headerEnd.split(" ").slice(-1)),
        col: col,
        startRowName: headerStart,
        endRowName: headerEnd,
        ...Object.fromEntries(new URLSearchParams(window.location.search).entries()),
    };
}

function deleteEntry(e) {
    let form = e.closest('form');
    submitEntryEditorForm({preventDefault: () => {}, target: form}, {"info.disabled": true})
}