Note: this software is still in active development, and as such may not have the smoothest of edges at this point in time.

## Introduction

A website created for the [Leyada High School](www.leyada.net) in order to manage the allocation of the laptops to the
many students and teachers interested in using them.

![Cart!](/public/assets/cart1.png "Cart")

### Background

The school contains a number of movable carts, each containing about 20 laptops, along with unmovable closets which can
contain anywhere from 10 to 20 laptops.
Before borrowing a cart for a lesson, the teachers are required to register in advance to ensure they will have an
available cart.

This used to be done by contacting the IT staff and having them manually enter the reservations into a big spreadsheet.
That was of course, highly inconvenient for everyone involved, so i was called upon to design a replacement.

Design goals were:

- Accommodate two kinds of reservations. Single use, and repeated use (same reservation slot, over many weeks)
- An improved management interface for the staff who still needs to be aware of the status of the carts, modify reservations, etc.
- Provide a way for teachers to place reservations on their own, without needing intervention of the staff.
- Minimize friction to maximize usage: ensure teachers will want to use the new system, without falling back on the old method and bothering the staff.
- Safe and secure: Ensure it is non-trivial for students to gain access to the system and mess around with it.
- Deploy and forget: 0 involvement necessary from a programmer to keep things running. this includes dealing with staff changes at the school as teachers come and go, and having everything required for regular management available via the graphical interface.

### Technology

The website is written on a Node backend with a Mongo database, with the frontend consisting of a mix of Bootstrap and Jquery, supporting the standard HTML pages styled with CSS and brought to life with custom clientside JS.

This rather basic, old-school toolset was deliberately chosen over the more recent options as a way to familiarize myself with web technologies.

Necessary information is queried from the School's GSuite via Google's Admin SDK.

### Ordering process

Beings with a simple google sign-in process, to ensure authentication matters are adequately safe.

![Login prompt](assets/1.png "Cart")

following which we will be redirected differently based on whether we are a teacher or IT staff.

The staff is immediately redirected to the current day's main matrix, which shows every slot available over a single
day, for all the available carts (and closets). Each slot contains the name of the teacher to whom the cart is assigned
at that time.
Above the matrix we have a date selection ribbon to select adjacent dates.

![Staff interface](https://imgur.com/zwcY3vB.png)

They can watch the status of current, past, and future reservations, colour coded by type (repeated use, repeated use
overwritten by a single use, and regular single use).
There is also the possibility of managing existing reservations or create new ones.
Creating a new reservation is as simple as clicking and dragging across the relevant timeslots,
at which point the user is prompted to enter the reservation details

Knowing everyone's exact email address is not realistic, so it features automatic completion for every teacher's email, also searchable by name.

![Create reservation - autocomplete](https://imgur.com/6624v7C.png)

Once the reservation is created, the table will automatically refreshed with the new data, for every other connected user.

We also have the ability to edit/delete existing reservations:

![Edit reservation](https://imgur.com/afdirj0.png)

Additionally, there's a simple UI to edit recurring reservations separately.

![Recurring reservations](assets/1.png "Cart")

On the teacher's side, we get a prompt to select the floor, and the date.

![Teacher prompt](https://imgur.com/a32OZm0.png)

Following which, we get the same matrix as in the staff side with a slightly different colour scheme. The matrix is restricted to the requested floor, selection works identically. the only information required to be passed at this point is the classroom location, for the staff to reference if necessary. The email is automatically inserted based on the currently logged-in user.

![Teacher reservation](https://imgur.com/6vDXOaQ.png)

This view also comes with the ability to delete reservations if the teacher changes their mind.

![Teacher delete reservation](https://imgur.com/gcTnF4I.png)

### Customer feedback

> An incredible improvement

> Extremely convenient and simple to use.

> A major workflow improvement

~ IT Multimedia Staff

### Installation

Download node:

- https://nodejs.org/en/download/

Install all the requirements by running the following command in the root directory:

    npm install

To run the website:

    node index.js