#!/usr/bin/perl

use strict;
use warnings;

use Test::More;
use Test::Fatal;

use Plack::Util;
use Plack::App::Debugger;
use Path::Class qw[ dir ];

our $DATA_DIR = dir('./t/100-lpw-2014-examples/tmp/');
our $JSON     = $Plack::App::Debugger::JSON;

# create tmp dir if needed
mkdir $DATA_DIR unless -e $DATA_DIR;

# cleanup tmp dir
{ ((-f $_ && $_->remove) || (-d $_ && $_->rmtree)) foreach $DATA_DIR->children( no_hidden => 1 ) }

foreach my $example ( glob('t/100-lpw-2014-examples/*-example.psgi') ) {
    is(
        exception { Plack::Util::load_psgi( $example ) },
        undef,
        '... successfully loaded example: ' . $example
    );
}

# cleanup tmp dir
{ ((-f $_ && $_->remove) || (-d $_ && $_->rmtree)) foreach $DATA_DIR->children( no_hidden => 1 ) }

done_testing;







