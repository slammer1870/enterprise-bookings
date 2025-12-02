#!/usr/bin/env python3
"""
Script to find the most popular classes and their most popular times.
This script analyzes lesson and booking data from the MCP Payload tools.
"""

import json
from collections import defaultdict, Counter
from datetime import datetime
from typing import Dict, List, Any, Tuple


def extract_time_from_iso_string(iso_string: str) -> str:
    """
    Extract time component (HH:MM) from an ISO 8601 datetime string.
    
    Args:
        iso_string: ISO 8601 formatted datetime string (e.g., "2024-01-15T10:30:00.000Z")
    
    Returns:
        Time string in HH:MM format (e.g., "10:30")
    """
    try:
        # Parse ISO 8601 string
        dt = datetime.fromisoformat(iso_string.replace('Z', '+00:00'))
        # Return time in HH:MM format
        return dt.strftime('%H:%M')
    except (ValueError, AttributeError) as e:
        print(f"Error parsing time string '{iso_string}': {e}")
        return None


def get_class_name_from_lesson(lesson: Dict[str, Any]) -> str:
    """
    Extract class name from a lesson object.
    
    Args:
        lesson: Lesson object from findLessons
    
    Returns:
        Class name string or None
    """
    class_option = lesson.get('classOption')
    if isinstance(class_option, dict):
        return class_option.get('name')
    return None


def get_class_name_from_booking(booking: Dict[str, Any]) -> str:
    """
    Extract class name from a booking object (via the lesson).
    
    Args:
        booking: Booking object from findBookings
    
    Returns:
        Class name string or None
    """
    lesson = booking.get('lesson')
    if isinstance(lesson, dict):
        class_option = lesson.get('classOption')
        if isinstance(class_option, dict):
            return class_option.get('name')
    return None


def analyze_class_popularity(lessons_data: List[Dict], bookings_data: List[Dict]) -> List[Tuple[str, str, int]]:
    """
    Analyze lessons and bookings to find the most popular time for each class.
    
    Args:
        lessons_data: List of lesson objects
        bookings_data: List of booking objects
    
    Returns:
        List of tuples: (class_name, most_popular_time, count)
    """
    # Dictionary to store class_name -> {time -> count}
    class_time_counts = defaultdict(lambda: defaultdict(int))
    
    # Process lessons
    for lesson in lessons_data:
        class_name = get_class_name_from_lesson(lesson)
        if class_name and 'startTime' in lesson and lesson['startTime']:
            time_str = extract_time_from_iso_string(lesson['startTime'])
            if time_str:
                class_time_counts[class_name][time_str] += 1
    
    # Process bookings (these represent actual attendance, so they're more important)
    for booking in bookings_data:
        class_name = get_class_name_from_booking(booking)
        if class_name:
            lesson = booking.get('lesson')
            if isinstance(lesson, dict) and 'startTime' in lesson and lesson['startTime']:
                time_str = extract_time_from_iso_string(lesson['startTime'])
                if time_str:
                    # Count bookings more heavily since they represent actual attendance
                    class_time_counts[class_name][time_str] += 2
    
    # Find most popular time for each class
    results = []
    for class_name, time_counts in class_time_counts.items():
        if time_counts:
            # Find the time with the highest count
            most_popular_time = max(time_counts.items(), key=lambda x: x[1])
            results.append((class_name, most_popular_time[0], most_popular_time[1]))
    
    # Sort by count (descending) to show most popular classes first
    results.sort(key=lambda x: x[2], reverse=True)
    
    return results


def main():
    """
    Main function to fetch data and display results.
    Note: This script expects to be run in an environment where MCP tools are available,
    or data should be provided via JSON files.
    """
    print("=" * 60)
    print("Finding Most Popular Classes and Their Most Popular Times")
    print("=" * 60)
    print()
    print("This script analyzes lesson and booking data.")
    print("To use this script, you need to:")
    print("1. Fetch lessons data using: mcp_Payload_findLessons (with limit=100)")
    print("2. Fetch bookings data using: mcp_Payload_findBookings (with limit=100)")
    print("3. Save the results as JSON files")
    print("4. Modify this script to read from those files")
    print()
    print("Alternatively, modify this script to call the MCP tools directly.")
    print()
    print("Expected output format:")
    print("  Class Name                          | Most Popular Time | Count")
    print("  ------------------------------------|------------------|------")
    print("  Mixed Levels (Gi Class)            | 12:00            | 45")
    print("  Mixed Levels (NoGi Class)           | 18:00            | 38")
    print()


if __name__ == "__main__":
    main()
