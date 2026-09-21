"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import jsPDF from "jspdf";
import { supabase } from "@/lib/supabase";

type Item = {
  name: string;
  qty: number;
  unit: string;
  rate: number;
};

type PaymentRecord = {
  id: string;
  amount: number;
  date: string;
  method: string;
};

type SavedQuotation = {
  id: string;
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  businessAddress: string;
  gstNumber: string;
  customer: string;
  phone: string;
  location: string;
  job: string;
  quotationNumber: string;
  quotationDate: string;
  items: Item[];
  discount: number;
  gstRate: number;
  total: number;
  amountPaid: number;
  payments: PaymentRecord[];
  paymentTerms: string;
  savedAt: string;
};

const formatCurrency = (value: number) =>
  `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;


const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const normalizePayments = (value: unknown): PaymentRecord[] =>
  Array.isArray(value)
    ? value.map((payment) => ({
        id: String(payment?.id ?? `${Date.now()}-${Math.random()}`),
        amount: Number(payment?.amount) || 0,
        date: String(payment?.date ?? ""),
        method: String(payment?.method ?? "Other"),
      }))
    : [];

const dbRowToQuotation = (row: any): SavedQuotation => ({
  id: String(row.id),
  businessName: row.business_name || "Your Business Name",
  businessPhone: row.business_phone || "",
  businessEmail: row.business_email || "",
  businessAddress: row.business_address || "",
  gstNumber: row.gst_number || "",
  customer: row.customer || "",
  phone: row.phone || "",
  location: row.location || "",
  job: row.job || "",
  quotationNumber: row.quotation_number || "",
  quotationDate: row.quotation_date || "",
  items: Array.isArray(row.items) ? row.items : [],
  discount: Number(row.discount) || 0,
  gstRate: Number(row.gst_rate) || 0,
  total: Number(row.total) || 0,
  amountPaid: Number(row.amount_paid) || 0,
  payments: normalizePayments(row.payments),
  paymentTerms: row.payment_terms || "50% advance, balance on completion",
  savedAt: row.created_at || new Date().toISOString(),
});

const quotationToDbRow = (quote: SavedQuotation, userId: string) => ({
  id: isUuid(quote.id) ? quote.id : crypto.randomUUID(),
  user_id: userId,
  business_name: quote.businessName || "Your Business Name",
  business_phone: quote.businessPhone || "",
  business_email: quote.businessEmail || "",
  business_address: quote.businessAddress || "",
  gst_number: quote.gstNumber || "",
  customer: quote.customer || "",
  phone: quote.phone || "",
  location: quote.location || "",
  job: quote.job || "",
  quotation_number: quote.quotationNumber || "",
  quotation_date: quote.quotationDate || "",
  items: quote.items || [],
  discount: Number(quote.discount) || 0,
  gst_rate: Number(quote.gstRate) || 0,
  total: Number(quote.total) || 0,
  amount_paid: Number(quote.amountPaid) || 0,
  payments: quote.payments || [],
  payment_terms: quote.paymentTerms || "50% advance, balance on completion",
  created_at: quote.savedAt || new Date().toISOString(),
});

export default function Home() {
    const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };
    useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
      }
    };

    checkSession();
  }, []);
  const [showForm, setShowForm] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCustomers, setShowCustomers] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [savedQuotations, setSavedQuotations] = useState<SavedQuotation[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("Your Business Name");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [gstNumber, setGstNumber] = useState("");

  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [job, setJob] = useState("");

  const [quotationNumber, setQuotationNumber] = useState(
    `QK-${Date.now().toString().slice(-6)}`
  );
  const [quotationDate, setQuotationDate] = useState(
    new Date().toLocaleDateString("en-IN")
  );

  const [items, setItems] = useState<Item[]>([]);
  const [discount, setDiscount] = useState(0);
  const [gstRate, setGstRate] = useState(18);
  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentTerms, setPaymentTerms] = useState(
    "50% advance, balance on completion"
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        const localSettings = localStorage.getItem("quotekaro_settings");
        if (localSettings) {
          const parsed = JSON.parse(localSettings);
          setBusinessName(parsed.businessName || "Your Business Name");
          setBusinessPhone(parsed.businessPhone || "");
          setBusinessEmail(parsed.businessEmail || "");
          setBusinessAddress(parsed.businessAddress || "");
          setGstNumber(parsed.gstNumber || "");
          setGstRate(Number(parsed.defaultGstRate ?? 18));
          setPaymentTerms(parsed.defaultPaymentTerms || "50% advance, balance on completion");
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        const userId = sessionData.session?.user?.id;

        if (!userId) {
          throw new Error("Please log in to load your QuoteKaro data.");
        }

        const { data, error } = await supabase
          .from("quotations")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;

        let quotations = (data || []).map(dbRowToQuotation);

        // Migrate any quotations that were previously saved only in localStorage.
        if (quotations.length === 0) {
          const localSaved = localStorage.getItem("quotekaro_quotations");
          if (localSaved) {
            const localQuotations = JSON.parse(localSaved) as SavedQuotation[];
            if (localQuotations.length > 0) {
              quotations = localQuotations.map((quote) => ({
                ...quote,
                id: isUuid(quote.id) ? quote.id : crypto.randomUUID(),
                gstNumber: quote.gstNumber || "",
                payments: Array.isArray(quote.payments) ? quote.payments : [],
              }));

              const { error: migrationError } = await supabase
                .from("quotations")
                .upsert(quotations.map((quote) => quotationToDbRow(quote, userId)), { onConflict: "id" });

              if (migrationError) throw migrationError;
            }
          }
        }

        setSavedQuotations(quotations);
        localStorage.setItem("quotekaro_quotations", JSON.stringify(quotations));
      } catch (error) {
        console.error("QuoteKaro data loading error:", error);
        try {
          const saved = localStorage.getItem("quotekaro_quotations");
          setSavedQuotations(saved ? JSON.parse(saved) : []);
        } catch {
          setSavedQuotations([]);
        }
      }
    };

    loadData();
  }, []);

  const saveBusinessSettings = (next: {
    businessName: string;
    businessPhone: string;
    businessEmail: string;
    businessAddress: string;
    gstNumber: string;
    defaultGstRate: number;
    defaultPaymentTerms: string;
  }) => {
    setBusinessName(next.businessName || "Your Business Name");
    setBusinessPhone(next.businessPhone);
    setBusinessEmail(next.businessEmail);
    setBusinessAddress(next.businessAddress);
    setGstNumber(next.gstNumber);
    setGstRate(Math.max(0, next.defaultGstRate));
    setPaymentTerms(next.defaultPaymentTerms || "50% advance, balance on completion");
    localStorage.setItem("quotekaro_settings", JSON.stringify(next));
    alert("Business settings saved successfully.");
  };

  const persistQuotations = async (quotes: SavedQuotation[]) => {
    setSavedQuotations(quotes);
    localStorage.setItem("quotekaro_quotations", JSON.stringify(quotes));

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("QuoteKaro Supabase session error:", sessionError);
      alert(`Could not verify your login: ${sessionError.message}`);
      return false;
    }

    const userId = sessionData.session?.user?.id;

    if (!userId) {
      alert("Please log in before saving quotations.");
      return false;
    }

    const { error } = await supabase
      .from("quotations")
      .upsert(quotes.map((quote) => quotationToDbRow(quote, userId)), { onConflict: "id" });

    if (error) {
      console.error("QuoteKaro Supabase save error:", error);
      alert(`Could not sync with Supabase: ${error.message}`);
      return false;
    }

    return true;
  };


  const subtotal = items.reduce(
    (total, item) => total + item.qty * item.rate,
    0
  );
  const discountAmount = Math.min(Math.max(discount, 0), subtotal);
  const taxableAmount = Math.max(subtotal - discountAmount, 0);
  const gst = taxableAmount * (gstRate / 100);
  const total = taxableAmount + gst;

  const generateQuotation = () => {
    if (!customer || !job) {
      alert("Please enter customer name and job description.");
      return;
    }

    const generatedItems: Item[] = [
      { name: "Wall preparation", qty: 950, unit: "sq.ft", rate: 8 },
      { name: "Primer application", qty: 950, unit: "sq.ft", rate: 12 },
      {
        name: "Interior paint - 2 coats",
        qty: 950,
        unit: "sq.ft",
        rate: 18,
      },
      { name: "Labour", qty: 1, unit: "job", rate: 12000 },
    ];

    setItems(generatedItems);
    setGenerated(true);
  };

  const addItem = () => {
    setItems([
      ...items,
      { name: "New item", qty: 1, unit: "unit", rate: 0 },
    ]);
  };

  const updateItem = (
    index: number,
    field: keyof Item,
    value: string | number
  ) => {
    setItems(
      items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const saveQuotation = async () => {
    if (!customer || !job) {
      alert("Please enter customer name and job description first.");
      return;
    }

    const existingQuote = editingId
      ? savedQuotations.find((q) => q.id === editingId)
      : undefined;
    const quoteId = editingId && isUuid(editingId) ? editingId : crypto.randomUUID();

    const quote: SavedQuotation = {
      id: quoteId,
      businessName,
      businessPhone,
      businessEmail,
      businessAddress,
      customer,
      phone,
      location,
      job,
      quotationNumber,
      quotationDate,
      items,
      discount,
      gstRate,
      total,
      amountPaid: (() => {
        const existing = existingQuote?.payments || [];
        if (existing.length > 0) {
          return Math.min(
            total,
            existing.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
          );
        }
        return existingQuote
          ? Math.min(Math.max(Number(existingQuote.amountPaid) || 0, 0), total)
          : 0;
      })(),
      payments: existingQuote?.payments || [],
      paymentTerms,
      gstNumber,
      savedAt: new Date().toISOString(),
    };

    const updated = editingId
      ? savedQuotations.map((q) => (q.id === editingId ? quote : q))
      : [quote, ...savedQuotations];

    const synced = await persistQuotations(updated);
    if (!synced) return;

    setEditingId(quote.id);
    setGenerated(true);
    alert(editingId ? "Quotation updated successfully." : "Quotation saved successfully.");
  };

  const loadQuotation = (quote: SavedQuotation) => {
    setBusinessName(quote.businessName);
    setBusinessPhone(quote.businessPhone);
    setBusinessEmail(quote.businessEmail);
    setBusinessAddress(quote.businessAddress);
    setCustomer(quote.customer);
    setPhone(quote.phone);
    setLocation(quote.location);
    setJob(quote.job);
    setQuotationNumber(quote.quotationNumber);
    setQuotationDate(quote.quotationDate);
    setItems(quote.items);
    setDiscount(quote.discount);
    setGstRate(quote.gstRate);
    setGstNumber(quote.gstNumber || gstNumber);
    setAmountPaid(Math.min(Math.max(quote.amountPaid || 0, 0), quote.total));
    setPaymentTerms(quote.paymentTerms || "50% advance, balance on completion");
    setEditingId(quote.id);
    setGenerated(true);
    setShowHistory(false);
    setShowForm(true);
  };

  const deleteQuotation = async (id: string) => {
    if (!confirm("Delete this quotation? This cannot be undone.")) return;

    const { error } = await supabase.from("quotations").delete().eq("id", id);
    if (error) {
      console.error("QuoteKaro Supabase delete error:", error);
      alert(`Could not delete from Supabase: ${error.message}`);
      return;
    }

    const updated = savedQuotations.filter((q) => q.id !== id);
    setSavedQuotations(updated);
    localStorage.setItem("quotekaro_quotations", JSON.stringify(updated));
    if (editingId === id) setEditingId(null);
  };

  const startNewQuotation = () => {
    setShowMobileMenu(false);
    setShowForm(true);
    setShowHistory(false);
    setShowCustomers(false);
    setGenerated(false);
    setEditingId(null);
    setQuotationNumber(`QK-${Date.now().toString().slice(-6)}`);
    setQuotationDate(new Date().toLocaleDateString("en-IN"));
    setItems([]);
    setDiscount(0);
    try {
      const settings = JSON.parse(localStorage.getItem("quotekaro_settings") || "{}");
      setGstRate(Number(settings.defaultGstRate ?? 18));
      setPaymentTerms(settings.defaultPaymentTerms || "50% advance, balance on completion");
    } catch {
      setGstRate(18);
      setPaymentTerms("50% advance, balance on completion");
    }
    setAmountPaid(0);
    setCustomer("");
    setPhone("");
    setLocation("");
    setJob("");
  };

  const shareOnWhatsApp = () => {
    if (!customer) {
      alert("Please enter customer name first.");
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    let whatsappPhone = cleanPhone;

    // If a 10-digit Indian number is entered, add India's country code.
    if (whatsappPhone.length === 10) {
      whatsappPhone = `91${whatsappPhone}`;
    }

    const message = [
      `Hello ${customer},`,
      "",
      `Thank you for choosing ${businessName || "our business"}.`,
      `Please find your quotation details below:`,
      "",
      `📋 Quotation No: ${quotationNumber}`,
      `📅 Date: ${quotationDate}`,
      `🏠 Project: ${job || "-"}`,
      `💰 Total Amount: ${formatCurrency(total)}`,
      `💳 Payment Terms: ${paymentTerms || "As mutually agreed"}`,
      "",
      "📎 The quotation PDF is ready to download and share.",
      "",
      "Please review the quotation and let us know if you have any questions or would like to discuss any changes.",
      "",
      "Thank you for your business!",
      businessName || "Our Team"
    ].join("\n");

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = whatsappPhone.length >= 10
      ? `https://wa.me/${whatsappPhone}?text=${encodedMessage}`
      : `https://wa.me/?text=${encodedMessage}`;

    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const downloadPDF = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const left = 18;
    const right = pageWidth - 18;
    const contentWidth = right - left;
    let y = 18;

    const money = (value: number) =>
      `Rs. ${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

    const addPageNumber = () => {
      const page = doc.getNumberOfPages();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`QuoteKaro  •  Page ${page}`, pageWidth / 2, pageHeight - 9, {
        align: "center",
      });
      doc.setTextColor(0, 0, 0);
    };

    const ensureSpace = (needed: number) => {
      if (y + needed > pageHeight - 18) {
        addPageNumber();
        doc.addPage();
        y = 18;
      }
    };

    // Header
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(left, 12, contentWidth, 38, 4, 4, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(21);
    doc.setTextColor(30, 41, 59);
    doc.text(businessName || "Your Business Name", left + 6, 23);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(90, 100, 110);
    let businessY = 29;
    if (businessPhone) {
      doc.text(`Phone: ${businessPhone}`, left + 6, businessY);
      businessY += 4.5;
    }
    if (businessEmail) {
      doc.text(`Email: ${businessEmail}`, left + 6, businessY);
      businessY += 4.5;
    }
    if (businessAddress) {
      const addressLines = doc.splitTextToSize(`Address: ${businessAddress}`, 92);
      doc.text(addressLines, left + 6, businessY);
      businessY += Math.max(4.5, addressLines.length * 4.2);
    }
    if (gstNumber) {
      doc.text(`GSTIN: ${gstNumber}`, left + 6, businessY);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.setTextColor(37, 99, 235);
    doc.text("QUOTATION", right - 6, 24, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(70, 80, 90);
    doc.text(`Quotation No: ${quotationNumber}`, right - 6, 31, { align: "right" });
    doc.text(`Date: ${quotationDate}`, right - 6, 36, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(editingId ? "SAVED QUOTATION" : "DRAFT", right - 6, 43, { align: "right" });

    y = 59;

    // Customer / project section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text("BILL TO", left, y);
    y += 6;

    doc.setDrawColor(225, 228, 232);
    doc.roundedRect(left, y - 2, contentWidth, 27, 3, 3, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(customer || "Customer", left + 5, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(85, 95, 105);
    doc.text(`Phone: ${phone || "Not provided"}`, left + 5, y + 11);
    doc.text(`Location: ${location || "Not provided"}`, left + 5, y + 17);
    doc.setTextColor(0, 0, 0);

    y += 33;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("PROJECT DESCRIPTION", left, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const jobLines = doc.splitTextToSize(job || "No job description provided.", contentWidth);
    doc.text(jobLines, left, y);
    y += jobLines.length * 4.2 + 7;

    // Items table
    const drawTableHeader = () => {
      doc.setFillColor(241, 245, 249);
      doc.rect(left, y, contentWidth, 9, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(45, 55, 65);
      doc.text("ITEM", left + 4, y + 6);
      doc.text("QTY", 112, y + 6, { align: "right" });
      doc.text("UNIT", 132, y + 6, { align: "right" });
      doc.text("RATE", 157, y + 6, { align: "right" });
      doc.text("AMOUNT", right - 4, y + 6, { align: "right" });
      y += 12;
      doc.setTextColor(0, 0, 0);
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("ITEMIZED QUOTATION", left, y);
    y += 5;
    drawTableHeader();

    if (items.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(120, 120, 120);
      doc.text("No items added yet.", left + 4, y + 5);
      doc.setTextColor(0, 0, 0);
      y += 12;
    } else {
      items.forEach((item) => {
        const amount = item.qty * item.rate;
        const nameLines = doc.splitTextToSize(item.name || "Item", 72);
        const rowHeight = Math.max(8, nameLines.length * 4.2 + 3);

        if (y + rowHeight > pageHeight - 30) {
          addPageNumber();
          doc.addPage();
          y = 18;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.text("ITEMIZED QUOTATION — CONTINUED", left, y);
          y += 6;
          drawTableHeader();
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text(nameLines, left + 4, y + 4.5);
        doc.text(String(item.qty), 112, y + 4.5, { align: "right" });
        doc.text(item.unit || "-", 132, y + 4.5, { align: "right" });
        doc.text(money(item.rate), 157, y + 4.5, { align: "right" });
        doc.text(money(amount), right - 4, y + 4.5, { align: "right" });

        doc.setDrawColor(232, 234, 238);
        doc.line(left, y + rowHeight, right, y + rowHeight);
        y += rowHeight;
      });
    }

    // Summary
    y += 7;
    ensureSpace(48);
    const summaryX = 116;
    const summaryWidth = right - summaryX;

    doc.setDrawColor(220, 224, 230);
    doc.line(summaryX, y, right, y);
    y += 7;

    const summaryRow = (label: string, value: number, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(bold ? 10.5 : 8.8);
      doc.text(label, summaryX, y);
      doc.text(money(value), right - 2, y, { align: "right" });
      y += bold ? 7 : 5.5;
    };

    summaryRow("Subtotal", subtotal);
    if (discountAmount > 0) summaryRow("Discount", -discountAmount);
    summaryRow("Taxable Amount", taxableAmount);
    if (gstRate > 0) summaryRow(`GST (${gstRate}%)`, gst);

    y += 2;
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(summaryX - 4, y - 5, summaryWidth + 4, 13, 2, 2, "F");
    doc.setTextColor(30, 64, 175);
    summaryRow("GRAND TOTAL", total, true);
    doc.setTextColor(0, 0, 0);

    // Payment summary
    const paidForPdf = Math.min(Math.max(Number(amountPaid) || 0, 0), total);
    const balanceForPdf = Math.max(total - paidForPdf, 0);
    ensureSpace(28);
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("PAYMENT SUMMARY", left, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("Payment terms", left, y);
    const paymentTermLines = doc.splitTextToSize(paymentTerms || "As mutually agreed", 78);
    doc.text(paymentTermLines, left + 30, y);
    y += Math.max(5, paymentTermLines.length * 4.2);
    doc.text("Amount paid", left, y);
    doc.text(money(paidForPdf), left + 30, y);
    y += 5;
    doc.text("Balance due", left, y);
    doc.setFont("helvetica", "bold");
    doc.text(money(balanceForPdf), left + 30, y);
    doc.setFont("helvetica", "normal");

    // Terms
    ensureSpace(52);
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("TERMS & CONDITIONS", left, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const terms = [
      "1. Quotation is subject to final site measurement and scope confirmation.",
      "2. Any additional work will be charged separately after customer approval.",
      `3. Payment terms: ${paymentTerms || "As mutually agreed"}.`,
      "4. This quotation is valid for 15 days from the quotation date.",
    ];

    terms.forEach((term) => {
      const lines = doc.splitTextToSize(term, contentWidth);
      doc.text(lines, left, y);
      y += lines.length * 4.2 + 1.5;
    });

    ensureSpace(30);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(90, 100, 110);
    doc.text("Thank you for your business.", left, y);
    y += 15;

    doc.setDrawColor(150, 155, 160);
    doc.line(left, y, left + 55, y);
    doc.line(right - 55, y, right, y);
    doc.setFontSize(7.5);
    doc.text("Customer Signature", left, y + 5);
    doc.text("Authorized Signatory", right, y + 5, { align: "right" });

    addPageNumber();

    doc.save(`QuoteKaro-${customer.replace(/[^a-z0-9]+/gi, "-") || "quotation"}.pdf`);
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5">
          <div>
            <h1 className="text-2xl font-bold">
              Quote<span className="text-blue-600">Karo</span>
            </h1>
            <p className="text-sm text-slate-500">
              Quotation & payment management for contractors
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMobileMenu((value) => !value)}
              className="rounded-xl border px-3 py-2 text-xl leading-none lg:hidden"
              aria-label="Toggle navigation menu"
              aria-expanded={showMobileMenu}
            >
              ☰
            </button>
            <button
              onClick={startNewQuotation}
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 sm:px-5 sm:text-base"
            >
              + New quotation
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-5 sm:gap-6 sm:px-6 sm:py-8 lg:grid-cols-[220px_1fr]">
        <aside className={`${showMobileMenu ? "block" : "hidden"} rounded-2xl border bg-white p-3 lg:block lg:p-4`}>
          <nav className="space-y-2">
            <button
              onClick={() => {
                setShowForm(false);
                setShowHistory(false);
                setShowCustomers(false);
                setShowPayments(false);
                setShowSettings(false);
                setShowMobileMenu(false);
              }}
              className="w-full rounded-xl bg-blue-50 px-4 py-3 text-left font-semibold text-blue-700"
            >
              ▦ Dashboard
            </button>

            <button
              onClick={startNewQuotation}
              className="w-full rounded-xl px-4 py-3 text-left hover:bg-slate-50"
            >
              ＋ New quotation
            </button>

            <button
              onClick={() => {
                setShowCustomers(true);
                setShowHistory(false);
                setShowForm(false);
                setShowPayments(false);
                setShowSettings(false);
                setShowMobileMenu(false);
              }}
              className="w-full rounded-xl px-4 py-3 text-left hover:bg-slate-50"
            >
              ♙ Customers
            </button>
            <button
              onClick={() => {
                setShowHistory(true);
                setShowForm(false);
                setShowCustomers(false);
                setShowPayments(false);
                setShowSettings(false);
                setShowMobileMenu(false);
              }}
              className="w-full rounded-xl px-4 py-3 text-left hover:bg-slate-50"
            >
              ▤ Quotations
            </button>
            <button
              onClick={() => {
                setShowPayments(true);
                setShowCustomers(false);
                setShowHistory(false);
                setShowForm(false);
                setShowSettings(false);
                setShowMobileMenu(false);
              }}
              className="w-full rounded-xl px-4 py-3 text-left hover:bg-slate-50"
            >
              ₹ Payments
            </button>

            <div className="my-5 border-t" />

           <button
  onClick={() => {
    setShowSettings(true);
    setShowPayments(false);
    setShowCustomers(false);
    setShowHistory(false);
    setShowForm(false);
    setShowMobileMenu(false);
  }}
  className="w-full rounded-xl px-4 py-3 text-left hover:bg-slate-50"
>
  ⚙ Settings
</button>

<button
  onClick={handleLogout}
  className="mt-2 w-full rounded-xl px-4 py-3 text-left text-red-600 hover:bg-red-50"
>
  ↪ Logout
</button>

          </nav>

          <div className="mt-6 rounded-xl bg-slate-50 p-4 sm:mt-8">
            <p className="text-xs text-slate-500">YOUR BUSINESS</p>
            <p className="mt-1 truncate font-semibold">{businessName || "Your Business Name"}</p>
            <p className="mt-1 text-xs text-slate-500">Free plan</p>
          </div>
        </aside>

        <section>
          {showSettings ? (
            <SettingsPanel
              businessName={businessName}
              businessPhone={businessPhone}
              businessEmail={businessEmail}
              businessAddress={businessAddress}
              gstNumber={gstNumber}
              defaultGstRate={gstRate}
              defaultPaymentTerms={paymentTerms}
              onSave={saveBusinessSettings}
              onBack={() => {
                setShowSettings(false);
              }}
            />
          ) : showPayments ? (
            <PaymentDirectory
              quotations={savedQuotations}
              onRecordPayment={(id, payment) => {
                const updated = savedQuotations.map((q) => {
                  if (q.id !== id) return q;
                  const existingPayments = Array.isArray(q.payments) ? q.payments : [];
                  const currentPaid = existingPayments.length > 0
                    ? existingPayments.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
                    : Number(q.amountPaid) || 0;
                  const remaining = Math.max(q.total - currentPaid, 0);
                  const safeAmount = Math.min(Math.max(payment.amount, 0), remaining);
                  if (safeAmount <= 0) return q;
                  const nextPayments = [
                    ...existingPayments,
                    { ...payment, amount: safeAmount },
                  ];
                  return {
                    ...q,
                    payments: nextPayments,
                    amountPaid: Math.min(
                      q.total,
                      nextPayments.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
                    ),
                  };
                });
                persistQuotations(updated);
              }}
              onDeletePayment={(quotationId, paymentId) => {
                const updated = savedQuotations.map((q) => {
                  if (q.id !== quotationId) return q;
                  const nextPayments = (Array.isArray(q.payments) ? q.payments : []).filter(
                    (payment) => payment.id !== paymentId
                  );
                  const nextPaid = nextPayments.reduce(
                    (sum, payment) => sum + (Number(payment.amount) || 0),
                    0
                  );
                  return {
                    ...q,
                    payments: nextPayments,
                    amountPaid: Math.min(q.total, nextPaid),
                  };
                });
                persistQuotations(updated);
              }}
            />
          ) : showCustomers ? (
            <CustomerDirectory
              quotations={savedQuotations}
              onNewForCustomer={(name, phone, location) => {
                startNewQuotation();
                setCustomer(name);
                setPhone(phone);
                setLocation(location);
              }}
            />
          ) : showHistory ? (
            <QuotationHistory
              quotations={savedQuotations}
              onOpen={loadQuotation}
              onDelete={deleteQuotation}
              onNew={startNewQuotation}
            />
          ) : !showForm ? (
            <>
              <div className="mb-6">
                <p className="text-sm text-slate-500">QuoteKaro</p>
                <h2 className="mt-1 text-2xl font-bold sm:text-3xl">
                  Create professional quotations in seconds.
                </h2>
                <p className="mt-2 text-slate-500">
                  Turn a simple job description into an itemized quotation.
                </p>
              </div>

              <div className="rounded-3xl bg-slate-950 p-5 text-white shadow-lg sm:p-8">
                <span className="rounded-full bg-blue-600/30 px-4 py-2 text-sm font-medium text-blue-300">
                  ✨ Smart quotations
                </span>

                <h2 className="mt-5 text-2xl font-bold sm:text-3xl md:text-4xl">
                  Create professional quotations in seconds.
                </h2>

                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
                  Describe the job in simple language. QuoteKaro turns your
                  requirements into a professional quotation.
                </p>

                <button
                  onClick={() => {
                    setShowForm(true);
                    setGenerated(false);
                  }}
                  className="mt-7 rounded-xl bg-white px-6 py-3 font-bold text-slate-950 hover:bg-slate-100"
                >
                  Create your first quote →
                </button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-4">
                <Stat
                  title="Total quotations"
                  value={String(savedQuotations.length)}
                  subtitle="Saved quotations"
                />
                <Stat
                  title="This month"
                  value={String(
                    savedQuotations.filter((q) => {
                      const date = new Date(q.savedAt);
                      const now = new Date();
                      return (
                        date.getMonth() === now.getMonth() &&
                        date.getFullYear() === now.getFullYear()
                      );
                    }).length
                  )}
                  subtitle="New quotations"
                />
                <Stat
                  title="Payments received"
                  value={formatCurrency(
                    savedQuotations.reduce(
                      (sum, q) => sum + Math.min(Math.max(q.amountPaid || 0, 0), q.total),
                      0
                    )
                  )}
                  subtitle="Total collected"
                />
                <Stat
                  title="Pending payments"
                  value={formatCurrency(
                    savedQuotations.reduce(
                      (sum, q) => sum + Math.max(q.total - (q.amountPaid || 0), 0),
                      0
                    )
                  )}
                  subtitle="Outstanding"
                />
              </div>

              <div className="mt-4 rounded-2xl border bg-white p-5 shadow-sm">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm text-slate-500">Business overview</p>
                    <h3 className="mt-1 text-xl font-bold">Quoted value</h3>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(
                      savedQuotations.reduce((sum, q) => sum + q.total, 0)
                    )}
                  </p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <MiniStat
                    label="Average quotation"
                    value={
                      savedQuotations.length
                        ? formatCurrency(
                            savedQuotations.reduce((sum, q) => sum + q.total, 0) /
                              savedQuotations.length
                          )
                        : "₹0"
                    }
                  />
                  <MiniStat
                    label="Fully paid"
                    value={String(
                      savedQuotations.filter(
                        (q) => q.total > 0 && (q.amountPaid || 0) >= q.total
                      ).length
                    )}
                  />
                  <MiniStat
                    label="Pending / partial"
                    value={String(
                      savedQuotations.filter(
                        (q) => (q.amountPaid || 0) < q.total
                      ).length
                    )}
                  />
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <Feature icon="✨" title="Smart Quotation" text="Turn a simple job description into an itemized quote." />
                <Feature icon="₹" title="Smart Pricing" text="Suggest labour and material pricing for your jobs." />
                <Feature icon="📄" title="Professional PDF" text="Generate a quotation ready to send to your customer." />
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowForm(false)}
                className="mb-5 text-sm font-semibold text-blue-600"
              >
                ← Back to dashboard
              </button>

              <div className="mb-6">
                <p className="text-sm text-slate-500">QuoteKaro</p>
                <h2 className="mt-1 text-2xl font-bold sm:text-3xl">
                  Create new quotation
                </h2>
                <p className="mt-2 text-slate-500">
                  Add your business and customer details, then generate the quote.
                </p>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-bold">Business Details</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    These details will appear on your quotation.
                  </p>

                  <div className="mt-5 space-y-4">
                    <Input
                      label="Business name"
                      placeholder="e.g. Om Painting Services"
                      value={businessName}
                      onChange={setBusinessName}
                    />
                    <Input
                      label="Business phone"
                      placeholder="e.g. 9876543210"
                      value={businessPhone}
                      onChange={setBusinessPhone}
                    />
                    <Input
                      label="Business email"
                      placeholder="e.g. om@example.com"
                      value={businessEmail}
                      onChange={setBusinessEmail}
                    />
                    <div>
                      <label className="mb-2 block text-sm font-semibold">
                        Business address
                      </label>
                      <textarea
                        value={businessAddress}
                        onChange={(e) => setBusinessAddress(e.target.value)}
                        placeholder="e.g. Pune, Maharashtra"
                        className="h-24 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-bold">Customer details</h3>

                  <div className="mt-5 space-y-4">
                    <Input
                      label="Customer name"
                      placeholder="e.g. Rahul Sharma"
                      value={customer}
                      onChange={setCustomer}
                    />
                    <Input
                      label="Phone number"
                      placeholder="e.g. 9876543210"
                      value={phone}
                      onChange={setPhone}
                    />
                    <Input
                      label="Project location"
                      placeholder="e.g. Wakad, Pune"
                      value={location}
                      onChange={setLocation}
                    />

                    <div>
                      <label className="mb-2 block text-sm font-semibold">
                        Describe the job
                      </label>
                      <textarea
                        value={job}
                        onChange={(e) => setJob(e.target.value)}
                        placeholder="Example: 2BHK painting in Wakad, around 950 sq ft. Need wall preparation, primer and two coats of interior paint."
                        className="h-32 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>

                    <button
                      onClick={generateQuotation}
                      className="w-full rounded-xl bg-blue-600 py-4 font-bold text-white hover:bg-blue-700"
                    >
                      ✨ Generate quotation
                    </button>
                  </div>
                </div>
              </div>

              {showForm && (
                <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px]">
                  <div className="rounded-2xl border bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold">Quotation items</h3>
                      <button
                        onClick={addItem}
                        className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                      >
                        + Add item
                      </button>
                    </div>

                    <div className="mt-5 space-y-3">
                      {items.map((item, index) => (
                        <div
                          key={index}
                          className="flex min-w-0 flex-wrap items-end gap-4 rounded-xl border p-4"
                        >
                          <div className="min-w-[180px] flex-[1_1_180px]">
                            <Input
                              label="Item name"
                              placeholder="Item"
                              value={item.name}
                              onChange={(value) =>
                                updateItem(index, "name", value)
                              }
                            />
                          </div>

                          <div className="w-full sm:w-auto sm:flex-[0_0_100px]">
                            <NumberInput
                              label="Qty"
                              value={item.qty}
                              onChange={(value) =>
                                updateItem(index, "qty", value)
                              }
                            />
                          </div>

                          <div className="w-full sm:w-auto sm:flex-[0_0_110px]">
                            <Input
                              label="Unit"
                              placeholder="sq.ft"
                              value={item.unit}
                              onChange={(value) =>
                                updateItem(index, "unit", value)
                              }
                            />
                          </div>

                          <div className="w-full sm:w-auto sm:flex-[0_0_120px]">
                            <NumberInput
                              label="Rate"
                              value={item.rate}
                              onChange={(value) =>
                                updateItem(index, "rate", value)
                              }
                            />
                          </div>

                          <div className="w-full sm:w-auto sm:flex-[0_0_150px]">
                            <label className="mb-2 block text-sm font-semibold">
                              Amount
                            </label>
                            <div className="rounded-xl bg-slate-50 px-4 py-3 font-semibold">
                              {formatCurrency(item.qty * item.rate)}
                            </div>
                          </div>

                          <div className="w-full sm:w-auto sm:flex-[0_0_90px]">
                            <button
                              onClick={() => removeItem(index)}
                              className="w-full rounded-xl border px-3 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-semibold">
                          Discount (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={discount}
                          onChange={(e) =>
                            setDiscount(Number(e.target.value) || 0)
                          }
                          className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold">
                          GST
                        </label>
                        <select
                          value={gstRate}
                          onChange={(e) =>
                            setGstRate(Number(e.target.value))
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
                        >
                          <option value={0}>No GST</option>
                          <option value={5}>5%</option>
                          <option value={12}>12%</option>
                          <option value={18}>18%</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="mb-2 block text-sm font-semibold">
                        Payment terms
                      </label>
                      <input
                        type="text"
                        value={paymentTerms}
                        onChange={(e) => setPaymentTerms(e.target.value)}
                        placeholder="e.g. 50% advance, balance on completion"
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        This will be included automatically in the WhatsApp message.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-white p-6 shadow-sm">
                    <QuotationPreview
                      businessName={businessName}
                      businessPhone={businessPhone}
                      businessEmail={businessEmail}
                      businessAddress={businessAddress}
                      gstNumber={gstNumber}
                      customer={customer}
                      phone={phone}
                      location={location}
                      job={job}
                      quotationNumber={quotationNumber}
                      quotationDate={quotationDate}
                      items={items}
                      subtotal={subtotal}
                      discountAmount={discountAmount}
                      taxableAmount={taxableAmount}
                      gstRate={gstRate}
                      gst={gst}
                      total={total}
                      amountPaid={amountPaid}
                      paymentTerms={paymentTerms}
                      onSaveQuotation={saveQuotation}
                      onDownloadPDF={downloadPDF}
                      onShareWhatsApp={shareOnWhatsApp}
                      isSaved={Boolean(editingId)}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function Stat({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
    </div>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="text-3xl">{icon}</div>
      <h3 className="mt-4 font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
    </div>
  );
}

function Input({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold">{label}</label>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function CustomerDirectory({
  quotations,
  onNewForCustomer,
}: {
  quotations: SavedQuotation[];
  onNewForCustomer: (name: string, phone: string, location: string) => void;
}) {
  const [search, setSearch] = useState("");

  const customerMap = new Map<
    string,
    {
      name: string;
      phone: string;
      location: string;
      quotations: number;
      total: number;
      paid: number;
      pending: number;
      lastDate: string;
    }
  >();

  quotations.forEach((quote) => {
    const name = quote.customer.trim();
    const phone = quote.phone.trim();
    if (!name) return;

    const key = `${name.toLowerCase()}|${phone}`;
    const existing = customerMap.get(key);
    const paid = Math.min(Math.max(Number(quote.amountPaid) || 0, 0), quote.total);

    if (existing) {
      existing.quotations += 1;
      existing.total += quote.total;
      existing.paid += paid;
      existing.pending += Math.max(quote.total - paid, 0);
      existing.location = existing.location || quote.location.trim();
      existing.lastDate = quote.quotationDate;
    } else {
      customerMap.set(key, {
        name,
        phone,
        location: quote.location.trim(),
        quotations: 1,
        total: quote.total,
        paid,
        pending: Math.max(quote.total - paid, 0),
        lastDate: quote.quotationDate,
      });
    }
  });

  const customers = Array.from(customerMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const filteredCustomers = customers.filter((item) => {
    const text = `${item.name} ${item.phone} ${item.location}`.toLowerCase();
    return text.includes(search.toLowerCase().trim());
  });

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm text-slate-500">QuoteKaro</p>
          <h2 className="mt-1 text-2xl font-bold sm:text-3xl">Customers</h2>
          <p className="mt-2 text-slate-500">
            Manage customers from your saved quotations and quickly create their next quote.
          </p>
        </div>
        <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
          {customers.length} customer{customers.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="mb-5 rounded-2xl border bg-white p-5 shadow-sm">
        <label className="mb-2 block text-sm font-semibold">Search customers</label>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone or location"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        {search.trim() && (
          <p className="mt-2 text-sm text-slate-500">
            Showing {filteredCustomers.length} of {customers.length} customers
          </p>
        )}
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="rounded-2xl border bg-white p-10 text-center shadow-sm">
          <div className="text-5xl">♙</div>
          <h3 className="mt-4 text-xl font-bold">
            {customers.length === 0 ? "No customers yet" : "No matching customers"}
          </h3>
          <p className="mt-2 text-slate-500">
            {customers.length === 0
              ? "Save a quotation to automatically add the customer here."
              : "Try a different name, phone number or location."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredCustomers.map((item) => (
            <div
              key={`${item.name}|${item.phone}`}
              className="rounded-2xl border bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold break-words">{item.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.phone || "No phone number"}
                  </p>
                  <p className="text-sm text-slate-500 break-words">
                    {item.location || "No location"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {item.quotations} quote{item.quotations === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3 rounded-xl bg-slate-50 p-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Total quoted</p>
                  <p className="mt-1 font-semibold">{formatCurrency(item.total)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Total paid</p>
                  <p className="mt-1 font-semibold">{formatCurrency(item.paid)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Pending</p>
                  <p className="mt-1 font-semibold">{formatCurrency(item.pending)}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-400">
                <span>Last quotation: {item.lastDate}</span>
                {item.pending === 0 ? (
                  <span className="font-semibold text-green-600">Paid in full</span>
                ) : (
                  <span className="font-semibold text-orange-600">Payment pending</span>
                )}
              </div>

              <button
                onClick={() => onNewForCustomer(item.name, item.phone, item.location)}
                className="mt-4 w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700"
              >
                + New quotation for customer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsPanel({
  businessName,
  businessPhone,
  businessEmail,
  businessAddress,
  gstNumber,
  defaultGstRate,
  defaultPaymentTerms,
  onSave,
  onBack,
}: {
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  businessAddress: string;
  gstNumber: string;
  defaultGstRate: number;
  defaultPaymentTerms: string;
  onSave: (settings: {
    businessName: string;
    businessPhone: string;
    businessEmail: string;
    businessAddress: string;
    gstNumber: string;
    defaultGstRate: number;
    defaultPaymentTerms: string;
  }) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState(businessName);
  const [phone, setPhone] = useState(businessPhone);
  const [email, setEmail] = useState(businessEmail);
  const [address, setAddress] = useState(businessAddress);
  const [gstin, setGstin] = useState(gstNumber);
  const [gst, setGst] = useState(defaultGstRate);
  const [terms, setTerms] = useState(defaultPaymentTerms);

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-5 text-sm font-semibold text-blue-600"
      >
        ← Back to dashboard
      </button>

      <div className="mb-6">
        <p className="text-sm text-slate-500">QuoteKaro</p>
        <h2 className="mt-1 text-2xl font-bold sm:text-3xl">Business Settings</h2>
        <p className="mt-2 text-slate-500">
          Save your business information once and reuse it on your quotations.
        </p>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Business name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your Business Name" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </Field>
          <Field label="Phone number">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </Field>
          <Field label="Email address">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </Field>
          <Field label="GSTIN (optional)">
            <input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </Field>
          <div className="md:col-span-2">
            <Field label="Business address">
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} placeholder="Shop / office address" className="input resize-none" />
            </Field>
          </div>
          <Field label="Default GST (%)">
            <input type="number" min="0" max="100" value={gst} onChange={(e) => setGst(Number(e.target.value) || 0)} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </Field>
          <Field label="Default payment terms">
            <input value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="50% advance, balance on completion" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </Field>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() =>
              onSave({
                businessName: name.trim(),
                businessPhone: phone.trim(),
                businessEmail: email.trim(),
                businessAddress: address.trim(),
                gstNumber: gstin.trim(),
                defaultGstRate: Math.min(Math.max(gst, 0), 100),
                defaultPaymentTerms: terms.trim(),
              })
            }
            className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
          >
            💾 Save settings
          </button>
          <button onClick={onBack} className="rounded-xl border px-5 py-3 font-semibold hover:bg-slate-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function PaymentDirectory({
  quotations,
  onRecordPayment,
  onDeletePayment,
}: {
  quotations: SavedQuotation[];
  onRecordPayment: (id: string, payment: PaymentRecord) => void;
  onDeletePayment: (quotationId: string, paymentId: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftAmount, setDraftAmount] = useState(0);
  const [draftDate, setDraftDate] = useState(new Date().toLocaleDateString("en-IN"));
  const [draftMethod, setDraftMethod] = useState("UPI");

  const paidFor = (quote: SavedQuotation) => {
    const payments = Array.isArray(quote.payments) ? quote.payments : [];
    if (payments.length > 0) {
      return Math.min(
        quote.total,
        payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
      );
    }
    return Math.min(Math.max(Number(quote.amountPaid) || 0, 0), quote.total);
  };

  const totalQuoted = quotations.reduce((sum, q) => sum + q.total, 0);
  const totalPaid = quotations.reduce((sum, q) => sum + paidFor(q), 0);
  const totalPending = Math.max(totalQuoted - totalPaid, 0);

  const statusFor = (quote: SavedQuotation) => {
    const paid = paidFor(quote);
    if (paid <= 0) return "Pending";
    if (paid >= quote.total) return "Paid";
    return "Partially paid";
  };

  const startEdit = (quote: SavedQuotation) => {
    const paid = paidFor(quote);
    setEditingId(quote.id);
    setDraftAmount(Math.max(quote.total - paid, 0));
    setDraftDate(new Date().toLocaleDateString("en-IN"));
    setDraftMethod("UPI");
  };

  const savePayment = (quote: SavedQuotation) => {
    const paid = paidFor(quote);
    const remaining = Math.max(quote.total - paid, 0);
    const amount = Math.min(Math.max(Number(draftAmount) || 0, 0), remaining);

    if (amount <= 0) {
      alert("Enter a payment amount greater than ₹0.");
      return;
    }

    onRecordPayment(quote.id, {
      id: `${Date.now()}`,
      amount,
      date: draftDate || new Date().toLocaleDateString("en-IN"),
      method: draftMethod,
    });
    setEditingId(null);
  };

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-slate-500">QuoteKaro</p>
        <h2 className="mt-1 text-2xl font-bold sm:text-3xl">Payments</h2>
        <p className="mt-2 text-slate-500">
          Record payments received and track outstanding amounts for your saved quotations.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat title="Total quoted" value={formatCurrency(totalQuoted)} subtitle="All saved quotations" />
        <Stat title="Amount received" value={formatCurrency(totalPaid)} subtitle="Payments recorded" />
        <Stat title="Outstanding" value={formatCurrency(totalPending)} subtitle="Still to collect" />
      </div>

      {quotations.length === 0 ? (
        <div className="mt-6 rounded-2xl border bg-white p-10 text-center shadow-sm">
          <div className="text-5xl">₹</div>
          <h3 className="mt-4 text-xl font-bold">No quotations to track</h3>
          <p className="mt-2 text-slate-500">
            Save a quotation first, then record payments here.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {quotations.map((quote) => {
            const paid = paidFor(quote);
            const pending = Math.max(quote.total - paid, 0);
            const status = statusFor(quote);
            const editing = editingId === quote.id;
            const payments = Array.isArray(quote.payments) ? quote.payments : [];

            return (
              <div key={quote.id} className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{quote.quotationNumber}</h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          status === "Paid"
                            ? "bg-emerald-50 text-emerald-700"
                            : status === "Partially paid"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-red-50 text-red-700"
                        }`}
                      >
                        {status}
                      </span>
                    </div>
                    <p className="mt-2 text-lg font-semibold">{quote.customer || "Unnamed customer"}</p>
                    <p className="text-sm text-slate-500">
                      {quote.businessName || "Your Business Name"} • {quote.quotationDate}
                    </p>
                  </div>

                  <div className="text-left md:text-right">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Grand total</p>
                    <p className="mt-1 text-2xl font-bold">{formatCurrency(quote.total)}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-400">Amount paid</p>
                    <p className="mt-1 font-semibold">{formatCurrency(paid)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-400">Pending</p>
                    <p className="mt-1 font-semibold">{formatCurrency(pending)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-400">Payment terms</p>
                    <p className="mt-1 font-semibold">{quote.paymentTerms || "Not specified"}</p>
                  </div>
                </div>

                {payments.length > 0 && (
                  <div className="mt-4 rounded-xl border bg-slate-50 p-4">
                    <p className="text-sm font-semibold">Payment history</p>
                    <div className="mt-2 space-y-2">
                      {payments.map((payment) => (
                        <div key={payment.id} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                          <span>{payment.date} • {payment.method}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold">{formatCurrency(payment.amount)}</span>
                            <button
                              onClick={() => {
                                if (confirm("Remove this payment record?")) {
                                  onDeletePayment(quote.id, payment.id);
                                }
                              }}
                              className="text-xs font-semibold text-red-600 hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {editing ? (
                  <div className="mt-4 rounded-xl border bg-slate-50 p-4">
                    <p className="text-sm font-semibold">Record payment</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold text-slate-600">Amount (₹)</span>
                        <input
                          type="number"
                          min="1"
                          max={Math.max(quote.total - paid, 0)}
                          value={draftAmount}
                          onChange={(e) => setDraftAmount(Number(e.target.value) || 0)}
                          className="w-full rounded-xl border bg-white px-4 py-3 outline-none focus:border-blue-500"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold text-slate-600">Payment date</span>
                        <input
                          type="text"
                          value={draftDate}
                          onChange={(e) => setDraftDate(e.target.value)}
                          placeholder="17/9/2026"
                          className="w-full rounded-xl border bg-white px-4 py-3 outline-none focus:border-blue-500"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold text-slate-600">Payment method</span>
                        <select
                          value={draftMethod}
                          onChange={(e) => setDraftMethod(e.target.value)}
                          className="w-full rounded-xl border bg-white px-4 py-3 outline-none focus:border-blue-500"
                        >
                          <option>UPI</option>
                          <option>Cash</option>
                          <option>Bank Transfer</option>
                          <option>Cheque</option>
                          <option>Other</option>
                        </select>
                      </label>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Remaining amount: {formatCurrency(pending)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => savePayment(quote)}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        Save payment
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  pending > 0 && (
                    <button
                      onClick={() => startEdit(quote)}
                      className="mt-4 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                    >
                      Record payment
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function QuotationHistory({
  quotations,
  onOpen,
  onDelete,
  onNew,
}: {
  quotations: SavedQuotation[];
  onOpen: (quote: SavedQuotation) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const getPaymentStatus = (quote: SavedQuotation) => {
    const payments = Array.isArray(quote.payments) ? quote.payments : [];

    const paid =
      payments.length > 0
        ? payments.reduce(
            (sum, payment) => sum + (Number(payment.amount) || 0),
            0
          )
        : Number(quote.amountPaid) || 0;

    const safePaid = Math.min(Math.max(paid, 0), quote.total);

    if (safePaid >= quote.total && quote.total > 0) return "Paid";
    if (safePaid > 0) return "Partially Paid";
    return "Pending";
  };

  const filteredQuotations = quotations.filter((quote) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [
      quote.customer,
      quote.quotationNumber,
      quote.job,
      quote.phone,
      quote.location,
    ].some((value) => value.toLowerCase().includes(query));

    const matchesStatus =
      statusFilter === "All" || getPaymentStatus(quote) === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm text-slate-500">QuoteKaro</p>
          <h2 className="mt-1 text-2xl font-bold sm:text-3xl">Quotation History</h2>
          <p className="mt-2 text-slate-500">
            Search, review and manage your saved quotations.
          </p>
        </div>
        <button
          onClick={onNew}
          className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
        >
          + New quotation
        </button>
      </div>

      {quotations.length === 0 ? (
        <div className="rounded-2xl border bg-white p-10 text-center shadow-sm">
          <div className="text-5xl">📋</div>
          <h3 className="mt-4 text-xl font-bold">No saved quotations yet</h3>
          <p className="mt-2 text-slate-500">
            Create a quotation and click “Save quotation” to see it here.
          </p>
          <button
            onClick={onNew}
            className="mt-6 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Create quotation
          </button>
        </div>
      ) : (
        <>
          <div className="mb-5 rounded-2xl border bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-[1fr_180px]">
              <div>
                <label className="mb-2 block text-sm font-semibold">Search quotations</label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Customer, quotation number, job, phone..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold">Payment status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option>All</option>
                  <option>Pending</option>
                  <option>Partially Paid</option>
                  <option>Paid</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between text-sm text-slate-500">
            <span>
              Showing {filteredQuotations.length} of {quotations.length} quotation{quotations.length === 1 ? "" : "s"}
            </span>
            {(search || statusFilter !== "All") && (
              <button
                onClick={() => {
                  setSearch("");
                  setStatusFilter("All");
                }}
                className="font-semibold text-blue-600 hover:text-blue-700"
              >
                Clear filters
              </button>
            )}
          </div>

          {filteredQuotations.length === 0 ? (
            <div className="rounded-2xl border bg-white p-10 text-center shadow-sm">
              <div className="text-4xl">🔎</div>
              <h3 className="mt-3 text-lg font-bold">No matching quotations</h3>
              <p className="mt-2 text-sm text-slate-500">
                Try a different search term or payment status.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredQuotations.map((quote) => {
                const paid = Math.min(Math.max(quote.amountPaid || 0, 0), quote.total);
                const pending = Math.max(quote.total - paid, 0);
                const status = getPaymentStatus(quote);

                const statusClass =
                  status === "Paid"
                    ? "bg-green-50 text-green-700"
                    : status === "Partially Paid"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-red-50 text-red-700";

                return (
                  <div
                    key={quote.id}
                    className="rounded-2xl border bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold">{quote.quotationNumber}</h3>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
                            {status}
                          </span>
                        </div>
                        <p className="mt-2 text-lg font-semibold">
                          {quote.customer || "Unnamed customer"}
                        </p>
                        <p className="text-sm text-slate-500">
                          {quote.businessName || "Your Business Name"} • {quote.quotationDate}
                        </p>
                        {quote.job && (
                          <p className="mt-1 text-sm text-slate-500">{quote.job}</p>
                        )}
                      </div>

                      <div className="text-left md:text-right">
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Grand total
                        </p>
                        <p className="mt-1 text-2xl font-bold">
                          {formatCurrency(quote.total)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-3">
                      <MiniStat label="Amount paid" value={formatCurrency(paid)} />
                      <MiniStat label="Pending" value={formatCurrency(pending)} />
                      <MiniStat label="Payment terms" value={quote.paymentTerms || "Not specified"} />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => onOpen(quote)}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        Open & Edit
                      </button>
                      <button
                        onClick={() => onOpen(quote)}
                        className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                      >
                        View
                      </button>
                      <button
                        onClick={() => onDelete(quote.id)}
                        className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function QuotationPreview({
  businessName,
  businessPhone,
  businessEmail,
  businessAddress,
  gstNumber,
  customer,
  phone,
  location,
  job,
  quotationNumber,
  quotationDate,
  items,
  subtotal,
  discountAmount,
  taxableAmount,
  gstRate,
  gst,
  total,
  amountPaid,
  paymentTerms,
  onDownloadPDF,
  onSaveQuotation,
  onShareWhatsApp,
  isSaved,
}: {
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  businessAddress: string;
  gstNumber: string;
  customer: string;
  phone: string;
  location: string;
  job: string;
  quotationNumber: string;
  quotationDate: string;
  items: Item[];
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  gstRate: number;
  gst: number;
  total: number;
  amountPaid: number;
  paymentTerms: string;
  onDownloadPDF: () => void;
  onSaveQuotation: () => void;
  onShareWhatsApp: () => void;
  isSaved: boolean;
}) {
  return (
    <div>
      <div className="flex items-start justify-between border-b pb-5">
        <div>
          <h3 className="text-2xl font-bold">
            {businessName || "Your Business Name"}
          </h3>
          {businessPhone && (
            <p className="mt-1 text-sm text-slate-500">{businessPhone}</p>
          )}
          {businessEmail && (
            <p className="text-sm text-slate-500">{businessEmail}</p>
          )}
          {businessAddress && (
            <p className="text-sm text-slate-500">{businessAddress}</p>
          )}
          {gstNumber && (
            <p className="text-sm text-slate-500">GSTIN: {gstNumber}</p>
          )}
          <p className="mt-2 text-sm font-medium text-blue-600">
            Professional quotation
          </p>
        </div>

        <span className={`rounded-full px-3 py-1 text-xs font-bold ${isSaved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          {isSaved ? "SAVED" : "DRAFT"}
        </span>
      </div>

      <div className="mt-4 grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-400">
            Quotation No.
          </p>
          <p className="mt-1 font-semibold">{quotationNumber}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-400">
            Date
          </p>
          <p className="mt-1 font-semibold">{quotationDate}</p>
        </div>
      </div>

      <div className="grid gap-4 py-5 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-400">
            Customer
          </p>
          <p className="mt-1 font-semibold">{customer}</p>
          {phone && <p className="text-sm text-slate-500">{phone}</p>}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-400">
            Project location
          </p>
          <p className="mt-1 font-semibold">
            {location || "Not provided"}
          </p>
        </div>
      </div>

      <div className="mb-5 rounded-xl border bg-white p-4">
        <p className="text-xs font-semibold uppercase text-slate-400">
          Job description
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{job}</p>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-3 text-left">Item</th>
              <th className="px-3 py-3 text-right">Qty</th>
              <th className="px-3 py-3 text-right">Unit</th>
              <th className="px-3 py-3 text-right">Rate</th>
              <th className="px-3 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index} className="border-t">
                <td className="px-3 py-3">
                  <p className="font-medium">{item.name}</p>
                </td>
                <td className="px-3 py-3 text-right">{item.qty}</td>
                <td className="px-3 py-3 text-right">{item.unit}</td>
                <td className="px-3 py-3 text-right">
                  {formatCurrency(item.rate)}
                </td>
                <td className="px-3 py-3 text-right font-medium">
                  {formatCurrency(item.qty * item.rate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 space-y-2 border-t pt-5 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>

        {discountAmount > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-500">Discount</span>
            <span>-{formatCurrency(discountAmount)}</span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-slate-500">Taxable amount</span>
          <span>{formatCurrency(taxableAmount)}</span>
        </div>

        {gstRate > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-500">GST ({gstRate}%)</span>
            <span>{formatCurrency(gst)}</span>
          </div>
        )}

        <div className="flex justify-between border-t pt-3 text-lg font-bold">
          <span>Grand Total</span>
          <span className="text-blue-600">{formatCurrency(total)}</span>
        </div>
      </div>

      <div className="mt-5 rounded-xl bg-slate-50 p-4">
        <p className="font-semibold">Payment summary</p>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Payment terms</span>
            <span className="text-right font-medium">{paymentTerms || "As mutually agreed"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Amount paid</span>
            <span>{formatCurrency(Math.min(Math.max(Number(amountPaid) || 0, 0), total))}</span>
          </div>
          <div className="flex justify-between border-t pt-2 font-bold">
            <span>Balance due</span>
            <span className="text-blue-600">{formatCurrency(Math.max(total - Math.min(Math.max(Number(amountPaid) || 0, 0), total), 0))}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border p-4">
        <p className="font-semibold">Terms & Conditions</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-500">
          <li>Quotation is subject to final site measurement and scope confirmation.</li>
          <li>Additional work will be charged separately after approval.</li>
          <li>Payment terms can be mutually agreed before work starts.</li>
          <li>Quotation validity: 15 days.</li>
        </ul>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6 pt-6 text-center text-xs text-slate-500">
        <div>
          <div className="mx-auto mb-2 h-10 w-32 border-b border-slate-300" />
          Customer Signature
        </div>
        <div>
          <div className="mx-auto mb-2 h-10 w-32 border-b border-slate-300" />
          Authorized Signatory
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          onClick={onSaveQuotation}
          className="rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700"
        >
          {isSaved ? "💾 Update quotation" : "💾 Save quotation"}
        </button>

        <button
          onClick={onDownloadPDF}
          className="rounded-xl border border-slate-300 py-3 font-semibold hover:bg-slate-50"
        >
          📄 Download PDF
        </button>
      </div>

      <button
        onClick={onShareWhatsApp}
        className="mt-3 w-full rounded-xl bg-green-600 py-3 font-semibold text-white hover:bg-green-700"
      >
        💬 Share on WhatsApp
      </button>
    </div>
  );
}
