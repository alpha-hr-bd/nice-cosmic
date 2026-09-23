let db;
let auth;

let products = [];
let sales = [];
let expenses = [];

let currentReport = null;


const $ = id =>
  document.getElementById(id);


function money(number) {

  return "৳" +
    Number(number || 0)
      .toLocaleString("en-BD", {
        maximumFractionDigits: 2
      });

}


function dateValue(value) {

  return value?.toDate
    ? value.toDate()
    : new Date(value);

}


function escapeHTML(value) {

  return String(value ?? "")
    .replace(/[&<>"']/g, char => {

      const map = {

        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"

      };

      return map[char];

    });

}


/* FIREBASE */

firebase.initializeApp(firebaseConfig);

auth = firebase.auth();

db = firebase.firestore();


/* AUTH */

auth.onAuthStateChanged(user => {

  if (user) {

    $("loginSection")
      .classList.add("hidden");

    $("dashboard")
      .classList.remove("hidden");

    $("logoutBtn")
      .classList.remove("hidden");

    loadData();

  } else {

    $("loginSection")
      .classList.remove("hidden");

    $("dashboard")
      .classList.add("hidden");

    $("logoutBtn")
      .classList.add("hidden");

  }

});


/* LOGIN */

$("loginForm").addEventListener(
  "submit",
  async e => {

    e.preventDefault();

    $("loginError").textContent = "";

    try {

      await auth.signInWithEmailAndPassword(

        $("loginEmail").value,

        $("loginPassword").value

      );

    }

    catch(error) {

      $("loginError").textContent =
        error.message;

    }

  }
);


/* LOGOUT */

$("logoutBtn").onclick = () => {

  auth.signOut();

};


/* LOAD DATA */

async function loadData() {

  try {

    const [
      productSnapshot,
      salesSnapshot,
      expenseSnapshot
    ] = await Promise.all([

      db
        .collection("products")
        .orderBy("name")
        .get(),

      db
        .collection("sales")
        .orderBy(
          "soldAt",
          "desc"
        )
        .limit(300)
        .get(),

      db
        .collection("expenses")
        .orderBy(
          "spentAt",
          "desc"
        )
        .limit(300)
        .get()

    ]);


    products =
      productSnapshot.docs.map(
        doc => ({
          id: doc.id,
          ...doc.data()
        })
      );


    sales =
      salesSnapshot.docs.map(
        doc => ({
          id: doc.id,
          ...doc.data()
        })
      );


    expenses =
      expenseSnapshot.docs.map(
        doc => ({
          id: doc.id,
          ...doc.data()
        })
      );


    render();

  }

  catch(error) {

    console.error(error);

    alert(
      "Data load error: " +
      error.message
    );

  }

}


/* RENDER */

function render() {

  const totalStock =
    products.reduce(
      (total, product) =>
        total +
        Number(product.qty || 0),
      0
    );


  const revenue =
    sales.reduce(
      (total, sale) =>
        total +
        Number(sale.revenue || 0),
      0
    );


  const profit =
    sales.reduce(
      (total, sale) =>
        total +
        Number(sale.profit || 0),
      0
    )
    -
    expenses.reduce(
      (total, expense) =>
        total +
        Number(expense.amount || 0),
      0
    );


  $("totalProducts")
    .textContent =
    products.length;


  $("totalStock")
    .textContent =
    totalStock;


  $("totalRevenue")
    .textContent =
    money(revenue);


  $("totalProfit")
    .textContent =
    money(profit);


  renderProducts();

  renderSaleProducts();

  renderSales();

}


/* PRODUCTS */

function renderProducts() {

  const search =
    $("searchProduct")
      .value
      .toLowerCase();


  const filtered =
    products.filter(
      product =>
        product.name
          .toLowerCase()
          .includes(search)
    );


  $("productTable").innerHTML =
    filtered.map(product => `

      <tr>

        <td>
          ${escapeHTML(product.name)}
        </td>

        <td>
          ${product.qty}
        </td>

        <td>
          ${money(product.buyPrice)}
        </td>

        <td>
          ${money(product.sellPrice)}
        </td>

        <td>
          ${money(product.minSellPrice)}
        </td>

        <td>
          ${money(product.maxSellPrice)}
        </td>

        <td>

          <button
            class="danger"
            onclick="
              deleteProduct('${product.id}')
            "
          >
            Delete
          </button>

        </td>

      </tr>

    `).join("");


}


/* SEARCH */

$("searchProduct").oninput =
  renderProducts;


/* ADD PRODUCT */

$("productForm").onsubmit =
  async e => {

    e.preventDefault();


    const product = {

      name:
        $("productName")
          .value
          .trim(),

      qty:
        Number(
          $("productQty").value
        ),

      buyPrice:
        Number(
          $("buyPrice").value
        ),

      sellPrice:
        Number(
          $("sellPrice").value
        ),

      minSellPrice:
        Number(
          $("minSellPrice").value || 0
        ),

      maxSellPrice:
        Number(
          $("maxSellPrice").value || 0
        ),

      createdAt:
        firebase.firestore
          .FieldValue
          .serverTimestamp()

    };


    await db
      .collection("products")
      .add(product);


    e.target.reset();

    showToast(
      "Product added successfully"
    );


    loadData();

  };


/* SALE PRODUCT LIST */

function renderSaleProducts() {

  $("saleProduct").innerHTML =

    `<option value="">
      Select Product
    </option>` +

    products.map(product => `

      <option value="${product.id}">

        ${escapeHTML(product.name)}
        — Stock: ${product.qty}

      </option>

    `).join("");

}


/* SELECT PRODUCT */

$("saleProduct").onchange = () => {

  const product =
    products.find(
      p =>
        p.id ===
        $("saleProduct").value
    );


  if (!product) {

    $("saleInfo")
      .textContent =
      "Select a product";

    return;

  }


  $("actualSellPrice")
    .value =
    product.sellPrice;


  $("saleInfo").innerHTML = `

    Stock:
    <b>${product.qty}</b>

    &nbsp; | &nbsp;

    Buy:
    <b>${money(product.buyPrice)}</b>

    &nbsp; | &nbsp;

    Normal Sell:
    <b>${money(product.sellPrice)}</b>

  `;

};


/* SALE */

$("saleForm").onsubmit =
  async e => {

    e.preventDefault();


    const productId =
      $("saleProduct").value;


    const quantity =
      Number(
        $("saleQty").value
      );


    const sellPrice =
      Number(
        $("actualSellPrice").value
      );


    if (!productId) {

      alert(
        "Select a product"
      );

      return;

    }


    if (quantity <= 0) {

      alert(
        "Invalid quantity"
      );

      return;

    }


    const productRef =
      db
        .collection("products")
        .doc(productId);


    try {

      await db.runTransaction(
        async transaction => {

          const snapshot =
            await transaction.get(
              productRef
            );


          if (!snapshot.exists) {

            throw new Error(
              "Product not found"
            );

          }


          const product =
            snapshot.data();


          const stock =
            Number(
              product.qty || 0
            );


          if (quantity > stock) {

            throw new Error(
              "Not enough stock"
            );

          }


          const buyPrice =
            Number(
              product.buyPrice || 0
            );


          const revenue =
            quantity *
            sellPrice;


          const cost =
            quantity *
            buyPrice;


          const profit =
            revenue -
            cost;


          transaction.update(
            productRef,
            {

              qty:
                stock -
                quantity

            }
          );


          const saleRef =
            db
              .collection("sales")
              .doc();


          transaction.set(
            saleRef,
            {

              productId,

              productName:
                product.name,

              qty:
                quantity,

              buyPrice,

              sellPrice,

              revenue,

              cost,

              profit,

              soldAt:
                firebase.firestore
                  .FieldValue
                  .serverTimestamp()

            }
          );

        }
      );


      e.target.reset();

      $("saleInfo")
        .textContent =
        "Select a product";


      showToast(
        "Sale recorded & stock updated"
      );


      loadData();

    }

    catch(error) {

      alert(
        error.message
      );

    }

  };


/* EXPENSE */

$("expenseForm").onsubmit =
  async e => {

    e.preventDefault();


    await db
      .collection("expenses")
      .add({

        title:
          $("expenseTitle")
            .value
            .trim(),

        amount:
          Number(
            $("expenseAmount").value
          ),

        spentAt:
          firebase.firestore
            .FieldValue
            .serverTimestamp()

      });


    e.target.reset();


    showToast(
      "Expense saved"
    );


    loadData();

  };


/* DELETE PRODUCT */

async function deleteProduct(id) {

  if (
    !confirm(
      "Delete this product?"
    )
  ) {

    return;

  }


  await db
    .collection("products")
    .doc(id)
    .delete();


  showToast(
    "Product deleted"
  );


  loadData();

}


/* SALES TABLE */

function renderSales() {

  $("salesTable").innerHTML =

    sales
      .slice(0,50)
      .map(sale => `

        <tr>

          <td>
            ${dateValue(
              sale.soldAt
            ).toLocaleString()}
          </td>

          <td>
            ${escapeHTML(
              sale.productName
            )}
          </td>

          <td>
            ${sale.qty}
          </td>

          <td>
            ${money(
              sale.revenue
            )}
          </td>

          <td>
            ${money(
              sale.profit
            )}
          </td>

        </tr>

      `)
      .join("");

}


/* REPORT */

function generateReport(type) {

  const now =
    new Date();


  let start;


  if (type === "today") {

    start =
      new Date(now);

    start.setHours(
      0,0,0,0
    );

  }


  else if (
    type === "month"
  ) {

    start =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );

  }


  else if (
    type === "year"
  ) {

    start =
      new Date(
        now.getFullYear(),
        0,
        1
      );

  }


  const selectedSales =
    sales.filter(
      sale =>
        type === "all" ||
        dateValue(
          sale.soldAt
        ) >= start
    );


  const selectedExpenses =
    expenses.filter(
      expense =>
        type === "all" ||
        dateValue(
          expense.spentAt
        ) >= start
    );


  const revenue =
    selectedSales.reduce(
      (a,s) =>
        a +
        Number(
          s.revenue || 0
        ),
      0
    );


  const cost =
    selectedSales.reduce(
      (a,s) =>
        a +
        Number(
          s.cost || 0
        ),
      0
    );


  const expense =
    selectedExpenses.reduce(
      (a,e) =>
        a +
        Number(
          e.amount || 0
        ),
      0
    );


  const netProfit =
    revenue -
    cost -
    expense;


  const quantity =
    selectedSales.reduce(
      (a,s) =>
        a +
        Number(
          s.qty || 0
        ),
      0
    );


  currentReport = {

    type,
    sales:
      selectedSales,

    revenue,
    cost,
    expense,
    netProfit,
    quantity

  };


  $("reportBox").innerHTML = `

    <b>
      ${type.toUpperCase()} REPORT
    </b>

    <br><br>

    Items Sold:
    ${quantity}

    <br>

    Revenue:
    ${money(revenue)}

    <br>

    Product Cost:
    ${money(cost)}

    <br>

    Expenses:
    ${money(expense)}

    <br><br>

    <strong>
      Net Profit/Loss:
      ${money(netProfit)}
    </strong>

  `;

}


/* PRINT PDF */

function printReport() {

  if (!currentReport) {

    generateReport("all");

  }


  const report =
    currentReport;


  const popup =
    window.open(
      "",
      "_blank"
    );


  popup.document.write(`

    <html>

    <head>

      <title>
        Nice Cosmic Shop Report
      </title>

      <style>

        body {
          font-family: Arial;
          padding: 30px;
        }

        h1 {
          color: #0879bd;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }

        th,
        td {
          border: 1px solid #ccc;
          padding: 8px;
          text-align: left;
        }

      </style>

    </head>

    <body>

      <h1>
        Nice Cosmic Shop
      </h1>

      <h2>
        ${report.type} Report
      </h2>

      <p>

        Revenue:
        ${money(report.revenue)}

        <br>

        Product Cost:
        ${money(report.cost)}

        <br>

        Expenses:
        ${money(report.expense)}

        <br>

        <b>
          Net Profit/Loss:
          ${money(report.netProfit)}
        </b>

      </p>


      <table>

        <tr>

          <th>Date</th>
          <th>Product</th>
          <th>Qty</th>
          <th>Revenue</th>
          <th>Profit</th>

        </tr>


        ${report.sales.map(
          sale => `

            <tr>

              <td>
                ${dateValue(
                  sale.soldAt
                ).toLocaleString()}
              </td>

              <td>
                ${escapeHTML(
                  sale.productName
                )}
              </td>

              <td>
                ${sale.qty}
              </td>

              <td>
                ${money(
                  sale.revenue
                )}
              </td>

              <td>
                ${money(
                  sale.profit
                )}
              </td>

            </tr>

          `
        ).join("")}

      </table>


      <script>

        window.onload =
          () => window.print();

      <\/script>

    </body>

    </html>

  `);


  popup.document.close();

}


/* TOAST */

function showToast(message) {

  const toast =
    $("toast");


  toast.textContent =
    message;


  toast.style.display =
    "block";


  setTimeout(
    () => {

      toast.style.display =
        "none";

    },
    2500
  );

}
