package Plack::Test::Debugger::ResultGenerator;

# ABSTRACT: Test utility module for generating dummy results

use strict;
use warnings;

use JSON::XS;

our $VERSION   = '0.01';
our $AUTHORITY = 'cpan:STEVAN';

use parent 'Exporter';
our @EXPORT = qw[
    result_generator
    create_root
    create_child
];

our $FILENAME_FMT = '%s.json';
our $JSON         = JSON::XS->new->utf8->pretty;

{
    my $UID_SEQ = 0;
    my $UID_FMT = '%04d'; 
    sub next_UID { sprintf $UID_FMT, ++$UID_SEQ }
}

sub result_generator {
    my ($uid, $parent_uid) = @_;
    return +{
        request_uid => $uid,                    
        uri         => 'http://localhost/',
        method      => 'GET',
        timestamp   => 1111111111,
        results     =>  [
            {
                title    => 'Tester',
                subtitle => '',
                result   => [
                    'before',
                    'after',
                    'cleanup'
                ]
            }
       ],
       ($parent_uid ? (parent_request_id => $parent_uid) : ())
    }    
}

sub create_root {
    my $dir      = shift;
    my $root_uid = next_UID;
    $dir->file( sprintf $FILENAME_FMT => $root_uid )
        ->spew( $JSON->encode( result_generator( $root_uid ) ) );
    return $root_uid;
}

sub create_child {
    my $dir      = shift;
    my $root_uid = shift;
    my $sub_uid  = next_UID;
    my $sub_dir  = $dir->subdir( $root_uid );
    $sub_dir->mkpath;
    $sub_dir->file( sprintf $FILENAME_FMT => $sub_uid )
            ->spew( $JSON->encode( result_generator( $sub_uid, $root_uid ) ) );
    return $sub_uid;
}

1;

__END__

=head1 DESCRIPTION

This is just a simple module used in the test suite to create some 
JSON files similar to the files the Debugger generates.

=head1 ACKNOWLEDGMENT

This module was originally developed for Booking.com. With approval 
from Booking.com, this module was generalized and published on CPAN, 
for which the authors would like to express their gratitude.



