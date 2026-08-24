import os
import qrcode
import tempfile
from io import BytesIO
from fpdf import FPDF
from app.models.bookings import Booking

class PDFGenerator:
    @staticmethod
    def generate_ticket_pdf(booking: Booking) -> bytes:
        # Create QR Code containing UUID, PNR, Ticket ID, and Trip ID
        passenger_ids = ",".join([str(p.id) for p in booking.passengers])
        qr_data = f"Booking:{booking.id}|PNR:{booking.pnr}|Tickets:{passenger_ids}|Trip:{booking.trip_id}"
        qr = qrcode.QRCode(version=1, box_size=5, border=1)
        qr.add_data(qr_data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        
        pdf = FPDF()
        pdf.add_page()
        
        # Draw Header
        pdf.set_font("helvetica", "B", 18)
        pdf.set_text_color(31, 41, 55) # dark slate
        pdf.cell(0, 10, "NEW BUS TRAVEL TICKET", ln=True, align="L")
        pdf.ln(4)
        
        # Details layout
        pdf.set_font("helvetica", "", 10)
        pdf.cell(50, 6, f"PNR: {booking.pnr}")
        pdf.cell(0, 6, f"Booking No: {booking.booking_number}", ln=True)
        pdf.cell(50, 6, f"Journey Date: {booking.journey_date.strftime('%Y-%m-%d %H:%M') if booking.journey_date else 'N/A'}")
        pdf.cell(0, 6, f"Operator: {booking.operator.name if booking.operator else 'N/A'}", ln=True)
        
        bus_number = booking.trip.bus.bus_number if booking.trip and booking.trip.bus else "N/A"
        pdf.cell(50, 6, f"Bus Number: {bus_number}")
        pdf.cell(0, 6, f"Ticket Status: {booking.ticket_status.upper()}", ln=True)
        pdf.ln(8)
        
        # Boarding & Dropping Points
        pdf.set_font("helvetica", "B", 12)
        pdf.cell(0, 8, "BOARDING & DROPPING POINTS", ln=True)
        pdf.set_font("helvetica", "", 10)
        
        b_name = booking.boarding_point.point_name if booking.boarding_point else "Main Terminal"
        b_time = booking.boarding_point.time.strftime('%H:%M') if booking.boarding_point else "Dep"
        b_lm = booking.boarding_point.landmark if booking.boarding_point else "N/A"
        pdf.cell(0, 6, f"Boarding Stop: {b_name} (Time: {b_time}) | Landmark: {b_lm}", ln=True)
        
        d_name = booking.dropping_point.point_name if booking.dropping_point else "Arrival Terminal"
        d_time = booking.dropping_point.time.strftime('%H:%M') if booking.dropping_point else "Arr"
        d_lm = booking.dropping_point.landmark if booking.dropping_point else "N/A"
        pdf.cell(0, 6, f"Dropping Stop: {d_name} (Time: {d_time}) | Landmark: {d_lm}", ln=True)
        
        gps_b = booking.boarding_point.gps_coordinates if booking.boarding_point else "N/A"
        gps_d = booking.dropping_point.gps_coordinates if booking.dropping_point else "N/A"
        pdf.cell(0, 6, f"GPS Coordinates - Boarding: [{gps_b}] | Dropping: [{gps_d}]", ln=True)
        
        inst = booking.boarding_point.pickup_instructions if booking.boarding_point else "Arrive early."
        pdf.cell(0, 6, f"Instructions: {inst}", ln=True)
        pdf.ln(8)
        
        # Passengers table
        pdf.set_font("helvetica", "B", 12)
        pdf.cell(0, 8, "PASSENGERS & SEAT DETAILS", ln=True)
        
        pdf.set_font("helvetica", "B", 10)
        pdf.cell(60, 6, "Passenger Name", border=1)
        pdf.cell(20, 6, "Age", border=1)
        pdf.cell(25, 6, "Gender", border=1)
        pdf.cell(30, 6, "Seat No", border=1)
        pdf.cell(40, 6, "Ticket ID", border=1, ln=True)
        
        pdf.set_font("helvetica", "", 10)
        for p in booking.passengers:
            seat_num = p.seat.seat_number if p.seat else "N/A"
            pdf.cell(60, 6, p.passenger_name, border=1)
            pdf.cell(20, 6, str(p.passenger_age), border=1)
            pdf.cell(25, 6, p.passenger_gender, border=1)
            pdf.cell(30, 6, seat_num, border=1)
            pdf.cell(40, 6, p.ticket_number, border=1, ln=True)
            
        pdf.ln(10)
        
        # Terms and Conditions
        pdf.set_font("helvetica", "B", 10)
        pdf.cell(0, 6, "Terms & Conditions:", ln=True)
        pdf.set_font("helvetica", "I", 8)
        pdf.cell(0, 4, "1. Please carry a valid original identity card (Aadhaar, Passport, etc.) for check-in.", ln=True)
        pdf.cell(0, 4, "2. Report at boarding terminal 15 minutes before the scheduled departure.", ln=True)
        pdf.cell(0, 4, "3. Tickets cancelled within 12 hours of departure will receive no refunds.", ln=True)
        
        # Write QR Code to temp file and place it
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
            img.save(tmp.name)
            tmp_name = tmp.name
            
        pdf.image(tmp_name, x=150, y=10, w=40)
        try:
            os.remove(tmp_name)
        except Exception:
            pass
            
        # fpdf2 returns a bytearray; Starlette can only render real bytes.
        return bytes(pdf.output())

    @staticmethod
    def generate_invoice_pdf(booking: Booking) -> bytes:
        pdf = FPDF()
        pdf.add_page()
        
        # Header
        pdf.set_font("helvetica", "B", 18)
        pdf.cell(0, 10, "NEW BUS TAX INVOICE", ln=True)
        pdf.set_font("helvetica", "", 10)
        pdf.cell(0, 5, "NEW BUS SOLUTIONS PRIVATE LIMITED", ln=True)
        pdf.cell(0, 5, "GSTIN: 27AABCN8888F1Z6 | HSN/SAC: 9964", ln=True)
        pdf.ln(8)
        
        # Invoice metadata
        pdf.set_font("helvetica", "", 10)
        pdf.cell(50, 6, f"Invoice No: INV-{booking.booking_number}")
        pdf.cell(0, 6, f"Date: {booking.created_at.strftime('%Y-%m-%d')}", ln=True)
        pdf.cell(50, 6, f"PNR Reference: {booking.pnr}")
        pdf.cell(0, 6, f"Payment Method: {booking.payments[0].payment_gateway.upper() if booking.payments else 'WALLET'}", ln=True)
        pdf.ln(8)
        
        # Passenger Details Summary
        pdf.set_font("helvetica", "B", 12)
        pdf.cell(0, 8, "BILLING & TRANSACTION DETAILS", ln=True)
        pdf.set_font("helvetica", "", 10)
        pdf.cell(0, 6, f"Customer Name: {booking.user.full_name if booking.user else 'Valued Customer'}", ln=True)
        pdf.cell(0, 6, f"Mobile: {booking.passengers[0].mobile if booking.passengers and booking.passengers[0].mobile else 'N/A'}", ln=True)
        pdf.cell(0, 6, f"Journey: Mumbai-Pune Route", ln=True)
        pdf.ln(8)
        
        # Calculations table
        pdf.set_font("helvetica", "B", 10)
        pdf.cell(100, 6, "Description", border=1)
        pdf.cell(50, 6, "Rate/Details", border=1)
        pdf.cell(40, 6, "Amount (INR)", border=1, ln=True)
        
        pdf.set_font("helvetica", "", 10)
        # Base Fare
        pdf.cell(100, 6, f"Base Passenger Fare (x{booking.passenger_count})", border=1)
        pdf.cell(50, 6, f"Base Rate", border=1)
        pdf.cell(40, 6, f"{booking.base_fare:.2f}", border=1, ln=True)
        
        # Discount
        pdf.cell(100, 6, "Coupon Discount Applied", border=1)
        pdf.cell(50, 6, f"Code: {booking.coupon.code if booking.coupon else 'None'}", border=1)
        pdf.cell(40, 6, f"-{booking.discount:.2f}", border=1, ln=True)
        
        # GST Tax
        pdf.cell(100, 6, "GST (CGST 2.5% + SGST 2.5%)", border=1)
        pdf.cell(50, 6, "Configurable GST (5%)", border=1)
        pdf.cell(40, 6, f"{booking.tax:.2f}", border=1, ln=True)
        
        # Wallet
        pdf.cell(100, 6, "Paid via Wallet Deduction", border=1)
        pdf.cell(50, 6, f"Wallet", border=1)
        pdf.cell(40, 6, f"-{booking.wallet_used:.2f}", border=1, ln=True)
        
        # Total
        pdf.set_font("helvetica", "B", 10)
        pdf.cell(150, 8, "Total Invoiced Amount (GST Incl.)", border=1)
        pdf.cell(40, 8, f"{booking.final_amount:.2f}", border=1, ln=True)
        pdf.ln(12)
        
        # Footer note
        pdf.set_font("helvetica", "I", 8)
        pdf.cell(0, 5, "This invoice registers complete taxation logs under HSN code 9964. CGST and SGST logs are reported.", ln=True)
        
        # fpdf2 returns a bytearray; Starlette can only render real bytes.
        return bytes(pdf.output())

    @staticmethod
    def generate_analytics_pdf(data: dict) -> bytes:
        from datetime import datetime
        pdf = FPDF()
        pdf.add_page()
        
        # Title
        pdf.set_font("helvetica", "B", 18)
        pdf.set_text_color(31, 41, 55)
        pdf.cell(0, 10, "NEW BUS PLATFORM ANALYTICS REPORT", ln=True, align="C")
        pdf.ln(5)
        
        # Date Generated
        pdf.set_font("helvetica", "I", 10)
        pdf.set_text_color(107, 114, 128)
        pdf.cell(0, 6, f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", ln=True, align="C")
        pdf.ln(10)
        
        # Summary KPI Cards
        summary = data.get("summary", {})
        pdf.set_font("helvetica", "B", 14)
        pdf.set_text_color(31, 41, 55)
        pdf.cell(0, 8, "1. Executive Summary", ln=True)
        pdf.ln(2)
        
        pdf.set_font("helvetica", "", 10)
        pdf.set_text_color(31, 41, 55)
        pdf.cell(90, 8, f"Total Revenue: INR {summary.get('revenue', 0.0):,.2f}", border=1)
        pdf.cell(90, 8, f"Total Bookings: {summary.get('bookings', 0)}", border=1, ln=True)
        pdf.cell(90, 8, f"Average Occupancy: {summary.get('occupancy', 0.0):.2f}%", border=1)
        pdf.cell(90, 8, f"Cancellation Rate: {summary.get('cancellation_rate', 0.0):.2f}%", border=1, ln=True)
        pdf.ln(10)
        
        # Top Routes Table
        pdf.set_font("helvetica", "B", 14)
        pdf.cell(0, 8, "2. Top Performing Routes", ln=True)
        pdf.ln(2)
        
        pdf.set_font("helvetica", "B", 10)
        pdf.cell(70, 6, "Route", border=1)
        pdf.cell(35, 6, "Bookings", border=1)
        pdf.cell(40, 6, "Revenue (INR)", border=1)
        pdf.cell(35, 6, "Occupancy %", border=1, ln=True)
        
        pdf.set_font("helvetica", "", 9)
        for route in data.get("routes", [])[:5]:
            route_name = f"{route.get('source')} - {route.get('destination')}"
            pdf.cell(70, 6, route_name, border=1)
            pdf.cell(35, 6, str(route.get("bookings_count", 0)), border=1)
            pdf.cell(40, 6, f"{route.get('revenue', 0.0):,.2f}", border=1)
            pdf.cell(35, 6, f"{route.get('occupancy_pct', 0.0):.1f}%", border=1, ln=True)
        pdf.ln(10)
        
        # Top Operators Table
        pdf.set_font("helvetica", "B", 14)
        pdf.cell(0, 8, "3. Top Operators", ln=True)
        pdf.ln(2)
        
        pdf.set_font("helvetica", "B", 10)
        pdf.cell(70, 6, "Operator Name", border=1)
        pdf.cell(35, 6, "Bookings", border=1)
        pdf.cell(40, 6, "Revenue (INR)", border=1)
        pdf.cell(35, 6, "Occupancy %", border=1, ln=True)
        
        pdf.set_font("helvetica", "", 9)
        for op in data.get("operators", [])[:5]:
            pdf.cell(70, 6, op.get("name", "N/A"), border=1)
            pdf.cell(35, 6, str(op.get("bookings_count", 0)), border=1)
            pdf.cell(40, 6, f"{op.get('revenue', 0.0):,.2f}", border=1)
            pdf.cell(35, 6, f"{op.get('occupancy_pct', 0.0):.1f}%", border=1, ln=True)
        pdf.ln(10)
        
        # Daily Report Table (recent 10 days)
        pdf.set_font("helvetica", "B", 14)
        pdf.cell(0, 8, "4. Recent Daily Performance", ln=True)
        pdf.ln(2)
        
        pdf.set_font("helvetica", "B", 10)
        pdf.cell(40, 6, "Date", border=1)
        pdf.cell(30, 6, "Bookings", border=1)
        pdf.cell(40, 6, "Revenue (INR)", border=1)
        pdf.cell(35, 6, "Occupancy %", border=1)
        pdf.cell(35, 6, "Cancellation %", border=1, ln=True)
        
        pdf.set_font("helvetica", "", 9)
        daily_list = data.get("time_series", {}).get("daily", [])
        for day in daily_list[-10:]:
            pdf.cell(40, 6, day.get("date", "N/A"), border=1)
            pdf.cell(30, 6, str(day.get("bookings", 0)), border=1)
            pdf.cell(40, 6, f"{day.get('revenue', 0.0):,.2f}", border=1)
            pdf.cell(35, 6, f"{day.get('occupancy', 0.0):.1f}%", border=1)
            pdf.cell(35, 6, f"{day.get('cancellations', 0.0):.1f}%", border=1, ln=True)
            
        # fpdf2 returns a bytearray; Starlette can only render real bytes.
        return bytes(pdf.output())
