let selectedElements = [];
selectedElements.divID = undefined;
selectedElements.currDate = undefined;
selectedElements.setFirst = (e) => {
    selectedElements.clear()
    selectedElements.start = e;
}

let IGNORE_REFRESH = false;

selectedElements.setLast = (e) => {
    selectedElements.clean(); // ensure there are no leftover highlights

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
    } else if (newRow < startRow) {
        startRow = newRow;
        selectedElements.direction_down = false;
    } else if (newRow <= endRow) {// here we have startRow < newRow < endRow, so we want to pick based on the current direction
        if (selectedElements.direction_down) endRow = newRow; else startRow = newRow;
    }
    if (startRow > endRow) [startRow, endRow] = [endRow, startRow];

    // Get all the cells in the same column as start
    let cells = $(`div#${selectedElements.divID} table tr td:nth-child(${col})`);

    // Slice the cells between the start and end rows
    let slice = cells.slice(startRow - 1, endRow); // we remove 1 because the CSS doesn't select headers

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
    // fetch the square from the server with the JSON as the body. needs to contain the entire selection information, so maybe a list of cells {cart + hours}/ just hours, a date, and a cart for identification
    fetch('/carts/render_editor', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(json)
    }).then(async response => {
        entry_editor = response.text()

        document.getElementById("entry_editor")?.remove();
        editorElement = $(await entry_editor).addClass("entry_editor")[0]

        if (!editorElement) throw new Error('response is empty.');

        // $(cell).append(editorElement)
        $(cell)[0].appendChild(editorElement)

        editorElement.style.visibility = "hidden";
        setTimeout(() => { // height is wrong otherwise, i don't really know why.
            const rect = editorElement.getBoundingClientRect();
            if (rect.right >= (window.innerWidth || document.documentElement.clientWidth)) editorElement.classList.add("right_aligned")
            let offset = (window.innerHeight || document.documentElement.clientHeight) - rect.bottom
            if (offset < 0) editorElement.style.translate = `0 ${offset}px`

            // activate the animation
            editorElement.style.visibility = "";
            editorElement.classList.add("entry_editor_animated");
        })


    }).then(() => {
        setupEntryEditorEvents();
        document.getElementById("userInput").focus();
    }).catch(error => {
        console.log(error.message)
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

});

function setupEntryEditorEvents() {
    $('input[type="checkbox"]').each(toggleNextElem).click(toggleNextElem); // initial setup to ensure everything is properly hidden or shown.
    $("#userInput").on("input focus", updateSuggestionList).on("blur", () => $(".suggestion_list").empty());
    $("ul:last-of-type").on("mousedown", (e) => e.preventDefault());
    const form = document.querySelector('form');
    form.addEventListener('submit', submitEntryEditorForm);
}

function updateSuggestionList(e) {
    let value = e.target.value;
    value = value.split(",").slice(-1)[0];
    if (value.length <= 1) {
        $(".suggestion_list").empty();
        return;
    }
    fetch('carts/get_users', {
        method: 'POST', headers: {
            'Accept': 'application/json, text/plain, */*', 'Content-Type': 'application/json'
        }, body: JSON.stringify({query: value})
    }).then(async (res) => {
        let suggestions = await res.json();
        // setup the clickable thingies.
        let sl = $(".suggestion_list").empty();
        for (let suggestion of suggestions) {
            let new_elem = $(`<li class="suggestion">${suggestion.email}</li>`).on("click", () => {
                e.target.value = [...e.target.value.split(",").slice(0, -1), suggestion.email].join(",");
                sl.empty(); // empty the list
            });
            sl.append(new_elem);
        }
    });
}

function toggleNextElem() {
    let cElem = $(this);
    let inputValue = cElem.parent().next();
    inputValue.css("display", cElem.is(":checked") ? "" : "none");
}

function submitEntryEditorForm(event, additional = {}) {
    event.preventDefault();
    IGNORE_REFRESH = true;

    const data = new FormData(event.target);
    const new_data = new FormData();
    console.log(data)
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
    }).then(() => {
        // full_data contains the date, which we can use to delete the matrix from the DOM, and query it anew
        $(`#matrix_${full_data.date}`).attr("id", `matrix_${full_data.date}_delete`);
        $(`[data-target="#matrix_${full_data.date}"]`).removeClass("active").click();

        IGNORE_REFRESH = false;
        console.log(`Refreshed ${full_data.date} due to fetch.`)
        // location.reload(true)
    });//.then(res => console.log(res));
}

function getReservationParameters() {
    let start = $(selectedElements.start);
    let end = $(selectedElements.end);

    // Get the column and row indices of the cells
    let col = start.index(); // + 1 because headers
    let startRow = start.parent().index() - 1; // parent is row
    let endRow = end.parent().index() - 1;
    let column = $("table tr td:nth-child(1)");
    let headerStart = column[startRow].innerHTML; // TODO use tags / classes instead

    if (headerStart === "Break") { // TODO move logic out of here...
        startRow += 1;
        headerStart = column[startRow].innerHTML;
    }

    let headerEnd = column[endRow].innerHTML; // check if it's a break, if so grab the header one down.
    if (headerEnd === "Break") {
        endRow -= 1;
        headerEnd = column[endRow].innerHTML;
    }
    return {
        cartName: $(".table th")[col].innerHTML,
        start: parseInt(headerStart.split(" ").slice(-1)) - 1,
        end: parseInt(headerEnd.split(" ").slice(-1)),
        col: col,
        startRowName: headerStart,
        endRowName: headerEnd,
        date: selectedElements.currDate
    };
}

function deleteEntry(e) {
    let form = e.closest('form');
    submitEntryEditorForm({
        preventDefault: () => {
        }, target: form
    }, {"info.disabled": true})
}